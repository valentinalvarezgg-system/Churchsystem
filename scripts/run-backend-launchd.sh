#!/usr/bin/env bash
# Arranca el backend desde launchd cargando backend/.env sin poner secretos en el plist.
# No imprime variables ni valores.

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKEND_DIR="${BACKEND_DIR:-$ROOT_DIR/backend}"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env}"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [[ -z "$NODE_BIN" && -x /usr/local/bin/node ]]; then
  NODE_BIN=/usr/local/bin/node
fi
if [[ -z "$NODE_BIN" && -x /opt/homebrew/bin/node ]]; then
  NODE_BIN=/opt/homebrew/bin/node
fi
if [[ -z "$NODE_BIN" && -x "$HOME/.nvm/current/bin/node" ]]; then
  NODE_BIN="$HOME/.nvm/current/bin/node"
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "ERROR: node no encontrado" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe $ENV_FILE" >&2
  exit 1
fi

chmod 600 "$ENV_FILE" 2>/dev/null || true

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
  if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value%%[[:space:]]#*}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ ( "$value" == \"*\" && "$value" == *\" ) || ( "$value" == \'*\' && "$value" == *\' ) ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  fi
done < "$ENV_FILE"

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-4000}"

cd "$BACKEND_DIR"
exec "$NODE_BIN" "$BACKEND_DIR/src/server.js"
