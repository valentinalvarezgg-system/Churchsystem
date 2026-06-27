#!/usr/bin/env bash
# Wrapper local para Cloudflare Tunnel.
# Prioriza named tunnel con credentials-file válido; si no existe, usa token
# guardado en ~/.cloudflared/church-system.token. No imprime secretos.

set -euo pipefail

CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-$(command -v cloudflared || true)}"
if [[ -z "$CLOUDFLARED_BIN" && -x /usr/local/bin/cloudflared ]]; then
  CLOUDFLARED_BIN=/usr/local/bin/cloudflared
fi
if [[ -z "$CLOUDFLARED_BIN" && -x /opt/homebrew/bin/cloudflared ]]; then
  CLOUDFLARED_BIN=/opt/homebrew/bin/cloudflared
fi
CLOUDFLARED_CONFIG="${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}"
CLOUDFLARED_TOKEN_FILE="${CLOUDFLARED_TOKEN_FILE:-$HOME/.cloudflared/church-system.token}"

if [[ -z "$CLOUDFLARED_BIN" || ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "ERROR: cloudflared no encontrado" >&2
  exit 1
fi

if [[ -f "$CLOUDFLARED_CONFIG" ]]; then
  CREDENTIALS_FILE="$(awk -F': *' '/credentials-file:/ {print $2; exit}' "$CLOUDFLARED_CONFIG" | sed "s#^~#$HOME#")"
  if [[ -n "$CREDENTIALS_FILE" && -f "$CREDENTIALS_FILE" ]]; then
    exec "$CLOUDFLARED_BIN" tunnel --config "$CLOUDFLARED_CONFIG" run
  fi
fi

if [[ -f "$CLOUDFLARED_TOKEN_FILE" ]]; then
  TOKEN="$(tr -d '\r\n' < "$CLOUDFLARED_TOKEN_FILE")"
  if [[ -n "$TOKEN" ]]; then
    exec "$CLOUDFLARED_BIN" tunnel run --token "$TOKEN"
  fi
fi

echo "ERROR: no hay credentials-file válido ni token file en $CLOUDFLARED_TOKEN_FILE" >&2
exit 1
