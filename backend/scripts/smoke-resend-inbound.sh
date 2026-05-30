#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
SECRET="${RESEND_INBOUND_SECRET:-}"
TO_ADDR="${TO_ADDR:-contacto@churchsystem.com.ar}"
FROM_ADDR="${FROM_ADDR:-qa-smoke@external.test}"
SUBJECT="${SUBJECT:-[SMOKE] inbound route test}"
BODY_TEXT="${BODY_TEXT:-Smoke inbound test $(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

if [[ -z "$SECRET" ]]; then
  echo "ERROR: falta RESEND_INBOUND_SECRET en el entorno."
  echo "Ejemplo:"
  echo "  RESEND_INBOUND_SECRET=xxx BASE_URL=https://churchsystem.com.ar ./scripts/smoke-resend-inbound.sh"
  exit 1
fi

ENDPOINT="${BASE_URL%/}/webhooks/resend/inbound?secret=${SECRET}"

echo "POST ${ENDPOINT}"
echo "to=${TO_ADDR} from=${FROM_ADDR}"

curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"from\": \"${FROM_ADDR}\",
    \"to\": \"${TO_ADDR}\",
    \"subject\": \"${SUBJECT}\",
    \"text\": \"${BODY_TEXT}\"
  }" | sed 's/^/response: /'

echo
echo "OK: request enviada. Verificar logs backend: 'Inbound email processed'."
