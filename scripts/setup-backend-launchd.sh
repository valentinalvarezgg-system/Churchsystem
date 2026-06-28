#!/usr/bin/env bash
# Instala/repara el backend local como LaunchAgent sin guardar secretos en el plist.
# Los secretos se leen en runtime desde backend/.env por scripts/run-backend-launchd.sh.

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LABEL="${LABEL:-com.churchsystem.backend}"
PLIST="${PLIST:-$HOME/Library/LaunchAgents/$LABEL.plist}"
RUNNER="${RUNNER:-$ROOT_DIR/scripts/run-backend-launchd.sh}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/backend/.env}"
STDOUT_LOG="${STDOUT_LOG:-/tmp/church-back.log}"
STDERR_LOG="${STDERR_LOG:-/tmp/church-back-err.log}"

if [[ ! -x "$RUNNER" ]]; then
  chmod +x "$RUNNER"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe $ENV_FILE. Crealo antes de instalar launchd." >&2
  exit 1
fi

chmod 600 "$ENV_FILE" 2>/dev/null || true
mkdir -p "$HOME/Library/LaunchAgents"

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

  <key>WorkingDirectory</key>
  <string>$ROOT_DIR/backend</string>

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

chmod 644 "$PLIST"

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Backend launchd instalado sin secretos en plist: $PLIST"
echo "Logs: $STDOUT_LOG / $STDERR_LOG"
