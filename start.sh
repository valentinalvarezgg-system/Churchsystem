#!/bin/bash
# ⛪ Church System Beta 2.4.1 — Launcher
ROOT="$HOME/Desktop/church-system-alpha"
G='\033[0;32m'; B='\033[1;34m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")

clear
printf "\n  ${B}⛪  Church System Beta 2.4.1${N}\n"
printf "  ────────────────────────────────────────\n\n"

# Limpiar caché Vite
rm -rf "$ROOT/frontend/node_modules/.vite" 2>/dev/null

# Matar procesos viejos
lsof -ti:4000 | xargs kill -9 2>/dev/null
pkill -f cloudflared 2>/dev/null
sleep 1

# Backend (sirve también el frontend compilado)
cd "$ROOT/backend"
node src/server.js > /tmp/church-back.log 2>&1 &
BPID=$!
for i in $(seq 1 10); do
  sleep 1
  curl -sf http://localhost:4000/health > /dev/null 2>&1 && break
done
curl -sf http://localhost:4000/health > /dev/null 2>&1 || { printf "  ${R}❌ Backend error${N}\n"; cat /tmp/church-back.log; exit 1; }
printf "  ${G}✅ Backend + Frontend OK${N}\n"

# Preguntar si quiere túnel público
printf "\n  ${Y}¿Activar acceso público (Cloudflare Tunnel)? [s/N]${N} "
read -t 8 -n 1 TUNNEL
echo ""

TUNNEL_URL=""
if [[ "$TUNNEL" =~ ^[sS]$ ]]; then
  printf "  ⏳ Iniciando túnel...\n"
  cloudflared tunnel --url http://localhost:4000 > /tmp/cf-tunnel.log 2>&1 &
  CFPID=$!
  for i in $(seq 1 15); do
    sleep 1
    TUNNEL_URL=$(grep -o "https://[a-z0-9-]*\.trycloudflare\.com" /tmp/cf-tunnel.log 2>/dev/null | head -1)
    [ -n "$TUNNEL_URL" ] && break
  done
  if [ -n "$TUNNEL_URL" ]; then
    printf "  ${G}✅ Túnel activo!${N}\n"
    # Guardar URL pública para el QR de check-in
    grep -v "^PUBLIC_URL" "$ROOT/backend/.env" > /tmp/env_tmp
    echo "PUBLIC_URL=$TUNNEL_URL" >> /tmp/env_tmp
    cp /tmp/env_tmp "$ROOT/backend/.env"
    kill $BPID 2>/dev/null; sleep 1
    cd "$ROOT/backend" && node src/server.js > /tmp/church-back.log 2>&1 &
    BPID=$!; sleep 3
  else
    printf "  ${Y}⚠️  Túnel tardó — revisá /tmp/cf-tunnel.log${N}\n"
  fi
fi

printf "\n  ────────────────────────────────────────\n"
printf "  ${G}🚀 Church System corriendo!${N}\n\n"
printf "  📍 Esta Mac:\n"
printf "     ${B}http://localhost:4000${N}\n\n"
printf "  📱 Red local (mismo WiFi):\n"
printf "     ${B}http://${LOCAL_IP}:4000${N}\n\n"
if [ -n "$TUNNEL_URL" ]; then
  printf "  🌐 Acceso público (cualquier dispositivo, cualquier red):\n"
  printf "     ${B}${TUNNEL_URL}${N}\n\n"
  printf "  ${Y}⚠️  Esta URL cambia cada vez que reiniciás el túnel.${N}\n\n"
fi
printf "  👤 admin@iglesia.com  /  admin123\n"
printf "  ${Y}Ctrl+C para apagar todo${N}\n"
printf "  ────────────────────────────────────────\n\n"

open "http://localhost:4000" 2>/dev/null &
[ -n "$TUNNEL_URL" ] && open "$TUNNEL_URL" 2>/dev/null &

trap "kill $BPID ${CFPID:-0} 2>/dev/null; lsof -ti:4000 2>/dev/null | xargs kill -9 2>/dev/null; pkill -f cloudflared 2>/dev/null; printf '\n  Apagado.\n'; exit 0" INT TERM
wait $BPID
