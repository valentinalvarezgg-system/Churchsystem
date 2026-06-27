#!/usr/bin/env bash
# diagnostico.sh — Diagnóstico operacional de Church System.
#
# Uso:
#   bash scripts/diagnostico.sh
#   bash scripts/diagnostico.sh --logs
#
# Revisa el modo activo actual:
#   - backend local en :4000
#   - launchd del backend/watchdog/caffeinate
#   - Cloudflare Tunnel local
#   - dominio público y /health
#   - git y estado de migración Render
#
# No imprime valores de secretos.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHOW_LOGS=false
[[ "${1:-}" == "--logs" ]] && SHOW_LOGS=true

PROD_URL="${PROD_URL:-https://churchsystem.com.ar}"
LOCAL_HEALTH="${LOCAL_HEALTH:-http://127.0.0.1:4000/health}"
BACKEND_LABEL="${BACKEND_LABEL:-com.churchsystem.backend}"
WATCHDOG_LABEL="${WATCHDOG_LABEL:-com.churchsystem.watchdog}"
CAFFEINATE_LABEL="${CAFFEINATE_LABEL:-com.churchsystem.caffeinate}"
CLOUDFLARED_LABEL="${CLOUDFLARED_LABEL:-com.churchsystem.cloudflared}"
CLOUDFLARED_CONFIG="${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; GREY='\033[0;90m'; NC='\033[0m'

ERRORS=0
WARNINGS=0

ok()   { echo -e "  ${GREEN}OK${NC}    $*"; }
fail() { echo -e "  ${RED}ERROR${NC} $*"; ERRORS=$((ERRORS+1)); }
warn() { echo -e "  ${YELLOW}WARN${NC}  $*"; WARNINGS=$((WARNINGS+1)); }
info() { echo -e "  ${GREY}INFO${NC}  $*"; }
sep()  { echo -e "\n${CYAN}── $* ──────────────────────────────────────────────────${NC}"; }
val()  { printf "  ${GREY}%-24s${NC} %s\n" "$1" "$2"; }

http_status() {
  local url="$1"
  curl -sS -o /tmp/churchsystem-diagnostic-body.$$ -w "%{http_code}" --max-time 10 "$url" 2>/tmp/churchsystem-diagnostic-curl.$$ || echo "ERR"
}

launchd_state() {
  local label="$1"
  if ! command -v launchctl >/dev/null 2>&1; then
    warn "launchctl no disponible en este sistema"
    return
  fi

  local out
  out="$(launchctl list "$label" 2>/dev/null || true)"
  if [[ -z "$out" ]]; then
    fail "$label no está cargado en launchd"
    return
  fi

  if echo "$out" | grep -q '"PID"'; then
    ok "$label activo"
  else
    warn "$label cargado pero sin PID activo"
  fi
}

redact_logs() {
  sed -E \
    -e 's#(postgresql://)[^[:space:]]+#\1[REDACTED]#g' \
    -e 's#(Bearer )[A-Za-z0-9._~+/=-]+#\1[REDACTED]#g' \
    -e 's#(--token[ =])[^[:space:]]+#\1[REDACTED]#g' \
    -e 's#(JWT_SECRET|QR_SECRET|DATABASE_URL|RESEND_API_KEY|VAPID_[A-Z_]+|META_[A-Z_]+|GOOGLE_CLIENT_SECRET|MP_ACCESS_TOKEN|ANTHROPIC_API_KEY|GROQ_API_KEY|GODMODE_USER_EMAIL|GODMODE_USER_PASSWORD)=?[^[:space:]]*#\1=[REDACTED]#g'
}

echo ""
echo -e "${CYAN}Church System — Diagnóstico operacional $(date '+%Y-%m-%d %H:%M:%S')${NC}"
val "Repo" "$ROOT_DIR"
val "Producción" "$PROD_URL"

sep "Runtime local"
if command -v node >/dev/null 2>&1; then
  ok "Node $(node -v)"
else
  fail "Node no encontrado"
fi

if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm $(pnpm -v)"
else
  fail "pnpm no encontrado"
fi

sep "Backend local"
LOCAL_STATUS="$(http_status "$LOCAL_HEALTH")"
LOCAL_BODY="$(cat /tmp/churchsystem-diagnostic-body.$$ 2>/dev/null || true)"
if [[ "$LOCAL_STATUS" == "200" && "$LOCAL_BODY" == *'"status":"ok"'* ]]; then
  ok "$LOCAL_HEALTH responde OK"
else
  fail "$LOCAL_HEALTH no responde OK (HTTP $LOCAL_STATUS)"
  [[ -s /tmp/churchsystem-diagnostic-curl.$$ ]] && val "curl" "$(cat /tmp/churchsystem-diagnostic-curl.$$)"
fi

if command -v lsof >/dev/null 2>&1; then
  LISTENERS="$(lsof -nP -iTCP:4000 -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $1 " pid=" $2 " " $9}' | paste -sd '; ' -)"
  [[ -n "$LISTENERS" ]] && ok "Puerto 4000 escuchando: $LISTENERS" || fail "Nada escucha en TCP :4000"
else
  warn "lsof no disponible; no se pudo revisar puerto 4000"
fi

sep "launchd"
launchd_state "$BACKEND_LABEL"
launchd_state "$WATCHDOG_LABEL"
launchd_state "$CAFFEINATE_LABEL"
launchd_state "$CLOUDFLARED_LABEL"

sep "Cloudflare Tunnel"
if pgrep -x cloudflared >/dev/null 2>&1; then
  ok "cloudflared está corriendo"
else
  fail "cloudflared no está corriendo; Cloudflare devolverá 502 si DNS sigue al túnel"
fi

if [[ -f "$CLOUDFLARED_CONFIG" ]]; then
  ok "Config Cloudflare encontrada"
  awk '/hostname:|service:/{gsub(/^[[:space:]-]+/, ""); print "    " $0}' "$CLOUDFLARED_CONFIG" \
    | sed -E 's/(credentials-file:|token:).*/\1 [REDACTED]/'
  if grep -q 'service: http://localhost:4000' "$CLOUDFLARED_CONFIG"; then
    warn "Producción depende del backend local :4000"
  fi
else
  warn "No existe $CLOUDFLARED_CONFIG"
fi

sep "Dominio público"
PROD_HEALTH_STATUS="$(http_status "$PROD_URL/health")"
PROD_HEALTH_BODY="$(cat /tmp/churchsystem-diagnostic-body.$$ 2>/dev/null || true)"
if [[ "$PROD_HEALTH_STATUS" == "200" && "$PROD_HEALTH_BODY" == *'"status":"ok"'* ]]; then
  ok "$PROD_URL/health responde OK"
else
  fail "$PROD_URL/health no responde OK (HTTP $PROD_HEALTH_STATUS)"
fi

ROOT_STATUS="$(http_status "$PROD_URL")"
if [[ "$ROOT_STATUS" == "200" ]]; then
  ok "$PROD_URL responde HTTP 200"
else
  fail "$PROD_URL responde HTTP $ROOT_STATUS"
fi

sep "Git"
if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH="$(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || echo 'N/A')"
  HEAD="$(git -C "$ROOT_DIR" log -1 --format='%h %s' 2>/dev/null || echo 'N/A')"
  STATUS="$(git -C "$ROOT_DIR" status --short 2>/dev/null || true)"
  val "Rama" "$BRANCH"
  val "HEAD" "$HEAD"
  [[ -z "$STATUS" ]] && ok "Working tree limpio" || warn "Hay cambios sin commitear"
else
  fail "$ROOT_DIR no parece ser repo git"
fi

sep "Verificador producción"
if [[ -f "$ROOT_DIR/scripts/verify-prod.mjs" ]]; then
  if node "$ROOT_DIR/scripts/verify-prod.mjs"; then
    ok "verify-prod pasó"
  else
    fail "verify-prod falló"
  fi
  if node "$ROOT_DIR/scripts/verify-prod.mjs" --require-render >/tmp/churchsystem-verify-render.$$ 2>&1; then
    ok "Producción ya no depende del túnel local"
  else
    warn "Migración Render incompleta; detalle:"
    sed 's/^/    /' /tmp/churchsystem-verify-render.$$
  fi
else
  warn "scripts/verify-prod.mjs no existe"
fi

sep "Logs"
if $SHOW_LOGS; then
  for file in /tmp/church-back-err.log /tmp/church-back.log /tmp/church-watchdog-err.log /tmp/church-watchdog.log; do
    if [[ -f "$file" ]]; then
      echo ""
      val "Archivo" "$file"
      tail -n 50 "$file" | redact_logs
    else
      warn "No existe $file"
    fi
  done
else
  info "Usá --logs para ver últimas 50 líneas redacted de logs locales"
fi

rm -f /tmp/churchsystem-diagnostic-body.$$ /tmp/churchsystem-diagnostic-curl.$$ /tmp/churchsystem-verify-render.$$ 2>/dev/null || true

sep "Resultado"
if [[ "$ERRORS" -gt 0 ]]; then
  fail "$ERRORS error(es), $WARNINGS advertencia(s)"
  exit 1
fi

if [[ "$WARNINGS" -gt 0 ]]; then
  warn "0 errores, $WARNINGS advertencia(s)"
  exit 0
fi

ok "Sin errores ni advertencias"
