#!/usr/bin/env bash
# diagnostico.sh — Estado completo del servidor Church System.
# Ejecutar en el servidor para ver qué está pasando.
#
# Uso:
#   bash scripts/diagnostico.sh
#   bash scripts/diagnostico.sh --logs   (muestra últimas 50 líneas de logs)

set -uo pipefail

APP_DIR='/var/www/church-system'
PM2_APP_NAME='church-system'
PORT=3000
SHOW_LOGS=false
[[ "${1:-}" == "--logs" ]] && SHOW_LOGS=true

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; GREY='\033[0;90m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✔${NC}  $*"; }
fail() { echo -e "  ${RED}✘${NC}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
sep()  { echo -e "\n${CYAN}── $* ──────────────────────────────────────────────────${NC}"; }
val()  { printf "  ${GREY}%-22s${NC}  %s\n" "$1" "$2"; }

echo ""
echo -e "${CYAN}  Church System — Diagnóstico  $(date '+%Y-%m-%d %H:%M:%S')${NC}"

# ── 1. Node ──────────────────────────────────────────────────────────────────
sep "Node / pnpm / pm2"
if command -v node &>/dev/null; then
  NODE_V=$(node -v)
  ok "Node $NODE_V"
  [[ "$NODE_V" == v20* ]] || warn "Se recomienda Node 20 (tenés $NODE_V)"
else
  fail "Node no encontrado"
fi

command -v pnpm &>/dev/null && ok "pnpm $(pnpm -v)" || fail "pnpm no encontrado"
command -v pm2  &>/dev/null && ok "pm2 $(pm2 -v)"   || fail "pm2 no encontrado"

# ── 2. PM2 proceso ───────────────────────────────────────────────────────────
sep "Proceso PM2"
if command -v pm2 &>/dev/null; then
  STATUS=$(pm2 jlist 2>/dev/null | node -e "
    const list=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const app=list.find(p=>p.name==='$PM2_APP_NAME');
    if(!app){console.log('NOT_FOUND');process.exit(0);}
    console.log([app.pm2_env.status,app.pid,app.pm2_env.restart_time,
      Math.round((app.monit?.memory||0)/1024/1024)+'MB',
      Math.round((app.monit?.cpu||0))+'%'
    ].join('|'));
  " 2>/dev/null || echo "NOT_FOUND")

  if [[ "$STATUS" == "NOT_FOUND" ]]; then
    fail "Proceso '$PM2_APP_NAME' no está en PM2"
  else
    IFS='|' read -r PM2_STATUS PM2_PID PM2_RESTARTS PM2_MEM PM2_CPU <<< "$STATUS"
    [[ "$PM2_STATUS" == "online" ]] && ok "Estado: $PM2_STATUS" || fail "Estado: $PM2_STATUS"
    val "PID"        "$PM2_PID"
    val "Reinicios"  "$PM2_RESTARTS"
    val "Memoria"    "$PM2_MEM"
    val "CPU"        "$PM2_CPU"
  fi
else
  warn "pm2 no disponible — no se puede verificar el proceso"
fi

# ── 3. Puerto ─────────────────────────────────────────────────────────────────
sep "Puerto $PORT"
if command -v ss &>/dev/null; then
  LISTENING=$(ss -tlnp 2>/dev/null | grep ":$PORT " || true)
elif command -v netstat &>/dev/null; then
  LISTENING=$(netstat -tlnp 2>/dev/null | grep ":$PORT " || true)
else
  LISTENING=""
fi

if [[ -n "$LISTENING" ]]; then
  ok "Puerto $PORT escuchando"
  echo -e "  ${GREY}$LISTENING${NC}"
else
  fail "Nada escucha en el puerto $PORT"
fi

# ── 4. HTTP healthcheck ───────────────────────────────────────────────────────
sep "HTTP"
if command -v curl &>/dev/null; then
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/health" --max-time 5 2>/dev/null || echo "ERR")
  if [[ "$HTTP_STATUS" == "200" ]]; then
    ok "/api/health → $HTTP_STATUS"
  else
    warn "/api/health → $HTTP_STATUS (puede ser normal si la ruta no existe)"
    # Try root
    HTTP_ROOT=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" --max-time 5 2>/dev/null || echo "ERR")
    val "/ →" "$HTTP_ROOT"
  fi
else
  warn "curl no disponible — no se puede hacer healthcheck"
fi

# ── 5. nginx ──────────────────────────────────────────────────────────────────
sep "nginx"
if command -v nginx &>/dev/null; then
  if systemctl is-active --quiet nginx 2>/dev/null; then
    ok "nginx activo"
    NGINX_CONF=$(nginx -T 2>/dev/null | grep -c "proxy_pass" || echo "?")
    val "proxy_pass entries" "$NGINX_CONF"
  else
    fail "nginx inactivo"
  fi
  nginx -t 2>&1 | grep -E "successful|failed" | while read -r line; do
    [[ "$line" == *"successful"* ]] && ok "$line" || fail "$line"
  done
else
  warn "nginx no instalado"
fi

# ── 6. Git ────────────────────────────────────────────────────────────────────
sep "Git"
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  BRANCH=$(git branch --show-current 2>/dev/null || echo "desconocida")
  LAST_COMMIT=$(git log -1 --format="%h  %s  (%ar)" 2>/dev/null || echo "N/A")
  REMOTE_HASH=$(git ls-remote origin HEAD 2>/dev/null | cut -f1 | head -c7 || echo "N/A")
  LOCAL_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "N/A")

  val "Rama"         "$BRANCH"
  val "Último commit" "$LAST_COMMIT"
  val "Local HEAD"   "$LOCAL_HASH"
  val "Remote HEAD"  "$REMOTE_HASH"

  [[ "$LOCAL_HASH" == "$REMOTE_HASH" ]] && ok "Servidor al día con remoto" || warn "Servidor desactualizado (local $LOCAL_HASH ≠ remote $REMOTE_HASH)"
else
  fail "No se encontró $APP_DIR/.git"
fi

# ── 7. Disco / memoria ────────────────────────────────────────────────────────
sep "Recursos"
DISK=$(df -h "$APP_DIR" 2>/dev/null | tail -1 | awk '{print $5 " usado de " $2 " en " $6}' || echo "N/A")
MEM=$(free -h 2>/dev/null | awk 'NR==2{print $3 " usados de " $2}' || echo "N/A")
val "Disco"    "$DISK"
val "Memoria"  "$MEM"

DISK_PCT=$(df "$APP_DIR" 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%' || echo "0")
[[ "$DISK_PCT" -gt 85 ]] && warn "Disco al $DISK_PCT% — quedan pocos GB" || ok "Disco OK ($DISK_PCT% usado)"

# ── 8. .env ────────────────────────────────────────────────────────────────────
sep ".env"
ENV_FILE="$APP_DIR/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  ok ".env encontrado"
  MISSING=0
  for VAR in DATABASE_URL JWT_SECRET GODMODE_USER_EMAIL GODMODE_USER_PASSWORD; do
    if grep -q "^${VAR}=" "$ENV_FILE" && [[ "$(grep "^${VAR}=" "$ENV_FILE" | cut -d= -f2-)" != "" ]]; then
      val "$VAR" "✔ configurado"
    else
      fail "$VAR no configurado"
      MISSING=$((MISSING+1))
    fi
  done
  [[ $MISSING -eq 0 ]] && ok "Variables críticas OK" || warn "$MISSING variable(s) faltante(s)"
else
  fail ".env no encontrado en $ENV_FILE"
fi

# ── 9. Logs (opcional) ────────────────────────────────────────────────────────
if $SHOW_LOGS && command -v pm2 &>/dev/null; then
  sep "Logs PM2 (últimas 50 líneas)"
  pm2 logs "$PM2_APP_NAME" --lines 50 --nostream 2>/dev/null || warn "No se pudieron obtener logs"
fi

echo ""
sep "Fin del diagnóstico"
echo ""
