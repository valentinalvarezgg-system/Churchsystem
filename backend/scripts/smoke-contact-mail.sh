#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
ALIAS="${ALIAS:-soporte}"
SCOPE="${SCOPE:-config}"
MODE="${MODE:-both}"

if [[ -z "$AUTH_TOKEN" ]]; then
  echo "ERROR: falta AUTH_TOKEN."
  echo "Ejemplo:"
  echo "  AUTH_TOKEN=jwt BASE_URL=https://churchsystem.com.ar SCOPE=godmode ALIAS=soporte MODE=both ./scripts/smoke-contact-mail.sh"
  exit 1
fi

if [[ "$SCOPE" != "config" && "$SCOPE" != "godmode" ]]; then
  echo "ERROR: SCOPE debe ser config o godmode."
  exit 1
fi

run_mode() {
  local current_mode="$1"
  local endpoint="${BASE_URL%/}/${SCOPE}/contact-mail-smoke"

  if [[ "$SCOPE" == "godmode" ]]; then
    endpoint="${BASE_URL%/}/godmode/mail-test"
  fi

  echo "POST ${endpoint} mode=${current_mode} alias=${ALIAS}"
  curl -sS -X POST "$endpoint" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"mode\":\"${current_mode}\",\"alias\":\"${ALIAS}\"}" | sed 's/^/response: /'
  echo
}

case "$MODE" in
  outbound|inbound)
    run_mode "$MODE"
    ;;
  both)
    run_mode outbound
    run_mode inbound
    ;;
  *)
    echo "ERROR: MODE debe ser outbound, inbound o both."
    exit 1
    ;;
esac

echo "OK: smoke test de contacto ejecutado."
