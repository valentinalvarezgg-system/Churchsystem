#!/usr/bin/env bash
# Instala Cloudflare Tunnel como LaunchAgent para evitar 502 si cae el proceso
# o se reinicia la Mac. No contiene tokens: usa ~/.cloudflared/config.yml.

set -euo pipefail

LABEL="${LABEL:-com.churchsystem.cloudflared}"
PLIST="${PLIST:-$HOME/Library/LaunchAgents/$LABEL.plist}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$(command -v cloudflared || true)}"
CLOUDFLARED_CONFIG="${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}"
CLOUDFLARED_TOKEN_FILE="${CLOUDFLARED_TOKEN_FILE:-$HOME/.cloudflared/church-system.token}"
RUNNER="${RUNNER:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-cloudflared-tunnel.sh}"
STDOUT_LOG="${STDOUT_LOG:-/tmp/church-cloudflared.log}"
STDERR_LOG="${STDERR_LOG:-/tmp/church-cloudflared-err.log}"

if [[ -z "$CLOUDFLARED_BIN" || ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "ERROR: cloudflared no encontrado. Instalalo antes de correr este script." >&2
  exit 1
fi

if [[ ! -f "$CLOUDFLARED_CONFIG" && ! -f "$CLOUDFLARED_TOKEN_FILE" ]]; then
  echo "ERROR: no existe $CLOUDFLARED_CONFIG ni $CLOUDFLARED_TOKEN_FILE" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/.cloudflared"
chmod 700 "$HOME/.cloudflared"

if [[ ! -f "$CLOUDFLARED_TOKEN_FILE" ]]; then
  CURRENT_TOKEN="$(ps -axo args | sed -nE 's/.*cloudflared.*--token[ =]([^[:space:]]+).*/\1/p' | head -1)"
  if [[ -n "$CURRENT_TOKEN" ]]; then
    umask 077
    printf '%s' "$CURRENT_TOKEN" > "$CLOUDFLARED_TOKEN_FILE"
    chmod 600 "$CLOUDFLARED_TOKEN_FILE"
    echo "OK: token local guardado en $CLOUDFLARED_TOKEN_FILE"
  fi
fi

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$RUNNER</string>
  </array>

  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>

  <key>StandardOutPath</key>
  <string>$STDOUT_LOG</string>
  <key>StandardErrorPath</key>
  <string>$STDERR_LOG</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "OK: $LABEL instalado y cargado"
echo "Logs: $STDOUT_LOG / $STDERR_LOG"
