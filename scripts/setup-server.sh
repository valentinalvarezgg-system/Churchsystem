#!/usr/bin/env bash
# setup-server.sh — Ejecutar UNA SOLA VEZ en el servidor VPS (como root).
# Instala Node 20 via nvm, pnpm, pm2, crea /var/www/church-system,
# clona el repo, hace el primer build y levanta el proceso con PM2.
#
# Uso (desde el servidor):
#   curl -fsSL https://raw.githubusercontent.com/<org>/<repo>/master/scripts/setup-server.sh | bash
#   —— o ——
#   bash scripts/setup-server.sh
#
# Editá las variables de la sección "Configuración" antes de ejecutar.

set -euo pipefail

# ── Configuración ────────────────────────────────────────────────────────────
REPO_URL='https://github.com/valentinalvarezgg-system/churchsystem.git'
APP_DIR='/var/www/church-system'
APP_USER='Valentin'          # Usuario que corre la app
NODE_VERSION='20'
PM2_APP_NAME='church-system'
PORT=3000
# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GREEN}✔${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✘${NC}  $*"; exit 1; }
sep()  { echo -e "\n${CYAN}────────────────────────────────────────────${NC}"; }

[[ $EUID -ne 0 ]] && err "Ejecutá como root (sudo -i o sudo bash setup-server.sh)"

sep
echo -e "${CYAN}  Church System — Server Setup${NC}"
sep

# 1. Dependencias del sistema
log "Actualizando paquetes …"
apt-get update -q && apt-get install -yq git curl wget build-essential nginx certbot python3-certbot-nginx

# 2. nvm + Node 20
if command -v node &>/dev/null && node -v | grep -q "v${NODE_VERSION}"; then
  log "Node $(node -v) ya instalado."
else
  log "Instalando nvm …"
  export NVM_DIR="/root/.nvm"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
  log "Instalando Node $NODE_VERSION …"
  nvm install "$NODE_VERSION"
  nvm alias default "$NODE_VERSION"
  nvm use default
  # Symlink para que sea accesible globalmente
  ln -sf "$(nvm which default)" /usr/local/bin/node
  ln -sf "$(dirname "$(nvm which default)")/npm" /usr/local/bin/npm
fi

# 3. pnpm
if command -v pnpm &>/dev/null; then
  log "pnpm $(pnpm -v) ya instalado."
else
  log "Instalando pnpm …"
  npm install -g pnpm
  ln -sf "$(which pnpm)" /usr/local/bin/pnpm 2>/dev/null || true
fi

# 4. pm2
if command -v pm2 &>/dev/null; then
  log "pm2 $(pm2 -v) ya instalado."
else
  log "Instalando pm2 …"
  npm install -g pm2
  ln -sf "$(which pm2)" /usr/local/bin/pm2 2>/dev/null || true
fi

# 5. Crear directorio de la app
log "Creando $APP_DIR …"
mkdir -p "$APP_DIR"
if id "$APP_USER" &>/dev/null && [[ "$APP_USER" != "root" ]]; then
  chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
fi

# 6. Clonar repositorio
if [[ -d "$APP_DIR/.git" ]]; then
  warn "Repositorio ya clonado en $APP_DIR — haciendo git pull …"
  cd "$APP_DIR" && git pull origin master
else
  log "Clonando repositorio …"
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# 7. Crear .env si no existe
if [[ ! -f "$APP_DIR/backend/.env" ]]; then
  warn "No existe backend/.env — creando plantilla. EDITALA antes de iniciar la app."
  cat > "$APP_DIR/backend/.env" <<'EOF'
# Church System — Variables de entorno
# Completá estos valores antes de iniciar la app.

NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/dbname

JWT_SECRET=cambia-esto-a-un-secreto-largo-y-aleatorio

# GodMode (admin raíz)
GODMODE_USER_EMAIL=admin@tudominio.com
GODMODE_USER_PASSWORD=cambia-esta-clave

# MercadoPago
MP_ACCESS_TOKEN=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENV=sandbox

# Transferencia manual
TRANSFERENCIA_BANCO=
TRANSFERENCIA_ALIAS=
TRANSFERENCIA_CBU=
TRANSFERENCIA_TITULAR=
TRANSFERENCIA_CUIT=

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=noreply@tudominio.com

# Reportes
OWNER_REPORTS_EMAIL=
SUPPORT_EMAIL=soporte@tudominio.com

# Frontend origin (CORS)
FRONTEND_URL=https://tudominio.com
EOF
  warn "Editá $APP_DIR/backend/.env con tus valores reales."
fi

# 8. Instalar dependencias del backend
log "Instalando dependencias del backend …"
cd "$APP_DIR/backend" && pnpm install --frozen-lockfile

# 9. Build del frontend
log "Instalando dependencias del frontend …"
cd "$APP_DIR/frontend" && pnpm install --frozen-lockfile
log "Construyendo frontend …"
pnpm build

# 10. Iniciar con PM2
log "Iniciando proceso con PM2 …"
cd "$APP_DIR"
if pm2 list | grep -q "$PM2_APP_NAME"; then
  warn "Proceso '$PM2_APP_NAME' ya existe en PM2 — reiniciando …"
  pm2 restart "$PM2_APP_NAME"
else
  pm2 start backend/src/server.js --name "$PM2_APP_NAME" --cwd "$APP_DIR" \
    --env production \
    -- --max-old-space-size=512
fi
pm2 save

# 11. PM2 en autostart
log "Configurando PM2 para iniciar con el sistema …"
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
pm2 save

# 12. Configurar nginx
NGINX_CONF="/etc/nginx/sites-available/church-system"
if [[ ! -f "$NGINX_CONF" ]]; then
  log "Creando configuración de nginx …"
  cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    server_name _;  # Reemplazar con tu dominio

    # Frontend (dist estático)
    root $APP_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API backend
    location /api/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/church-system
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  log "nginx configurado."
else
  warn "Configuración nginx ya existe en $NGINX_CONF — no se sobreescribe."
fi

# Resumen
sep
echo -e "${GREEN}  ✔ Setup completo${NC}"
sep
echo ""
echo -e "  App corriendo en:  ${CYAN}http://$(hostname -I | awk '{print $1}')${NC}"
echo -e "  PM2 status:        $(pm2 list --no-color | grep $PM2_APP_NAME | awk '{print $18}' | head -1)"
echo ""
echo -e "  ${YELLOW}Próximos pasos:${NC}"
echo "    1. Editá $APP_DIR/backend/.env con los valores reales"
echo "    2. pm2 restart $PM2_APP_NAME (después de editar .env)"
echo "    3. Configurá SSL: certbot --nginx -d tudominio.com"
echo "    4. Agregá los GitHub Secrets (ver DEPLOY-README.md)"
echo ""
sep
