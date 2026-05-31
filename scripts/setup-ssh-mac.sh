#!/usr/bin/env bash
# setup-ssh-mac.sh — Ejecutar UNA SOLA VEZ desde tu Mac.
# Genera la clave SSH dedicada para deploy, la copia al servidor,
# y al final imprime la clave privada lista para pegar en GitHub Secrets.
#
# Uso:
#   chmod +x scripts/setup-ssh-mac.sh
#   ./scripts/setup-ssh-mac.sh
#
# Solo editá las 3 variables de abajo si tu servidor difiere del default.

set -euo pipefail

# ── Configuración ────────────────────────────────────────────────────────────
SSH_HOST=''               # IP o dominio del servidor (OBLIGATORIO — editá esto)
SSH_USER='Valentin'       # Usuario SSH
SSH_PORT='22'             # Puerto SSH
KEY_NAME='church-system-deploy'
KEY_PATH="$HOME/.ssh/$KEY_NAME"
# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GREEN}✔${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✘${NC}  $*"; exit 1; }
sep()  { echo -e "\n${CYAN}────────────────────────────────────────────${NC}"; }

sep
echo -e "${CYAN}  Church System — SSH Deploy Key Setup${NC}"
sep

# Validar host
if [[ -z "$SSH_HOST" ]]; then
  read -rp "  IP o dominio del servidor: " SSH_HOST
fi
[[ -z "$SSH_HOST" ]] && err "SSH_HOST no puede estar vacío."

# 1. Generar clave si no existe
if [[ -f "$KEY_PATH" ]]; then
  warn "Ya existe $KEY_PATH — se reutilizará (no se sobreescribe)."
else
  log "Generando par de claves en $KEY_PATH …"
  ssh-keygen -t ed25519 -f "$KEY_PATH" -C "church-deploy@$(hostname)" -N ""
fi

# 2. Copiar clave pública al servidor
log "Copiando clave pública a ${SSH_USER}@${SSH_HOST}:${SSH_PORT} …"
ssh-copy-id -i "${KEY_PATH}.pub" -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" \
  || err "Falló ssh-copy-id. Asegurate de poder conectarte con contraseña primero."

# 3. Test de conexión sin contraseña
log "Verificando conexión sin contraseña …"
ssh -i "$KEY_PATH" -p "$SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=no \
    "${SSH_USER}@${SSH_HOST}" "echo OK" \
  && log "Conexión exitosa." \
  || err "La clave se copió pero la conexión falló. Revisá permisos en ~/.ssh/authorized_keys del servidor."

# 4. Agregar a ~/.ssh/config (conveniente para comandos manuales)
CONFIG_BLOCK="
# Church System deploy key
Host church-server
  HostName $SSH_HOST
  User $SSH_USER
  Port $SSH_PORT
  IdentityFile $KEY_PATH
  IdentitiesOnly yes
"
if grep -q "church-server" "$HOME/.ssh/config" 2>/dev/null; then
  warn "Ya existe entrada 'church-server' en ~/.ssh/config — no se modifica."
else
  echo "$CONFIG_BLOCK" >> "$HOME/.ssh/config"
  chmod 600 "$HOME/.ssh/config"
  log "Entrada 'church-server' agregada a ~/.ssh/config."
fi

# 5. Imprimir clave privada para GitHub Secrets
sep
echo -e "${CYAN}  PASO FINAL — Agregar a GitHub Secrets${NC}"
sep
echo ""
echo -e "  Ve a: ${YELLOW}https://github.com/<tu-org>/<tu-repo>/settings/secrets/actions${NC}"
echo ""
echo -e "  Creá estos 4 secrets:"
echo ""
printf "  %-25s %s\n" "Secret"           "Valor"
printf "  %-25s %s\n" "─────────────────────────" "────────────────────────────────"
printf "  %-25s %s\n" "SSH_HOST"          "$SSH_HOST"
printf "  %-25s %s\n" "SSH_USER"          "$SSH_USER"
printf "  %-25s %s\n" "SSH_PORT"          "$SSH_PORT"
printf "  %-25s %s\n" "SSH_PRIVATE_KEY"   "(ver abajo)"
echo ""
echo -e "  ${YELLOW}── Contenido de SSH_PRIVATE_KEY (copiá TODO, incluyendo las líneas BEGIN/END):${NC}"
echo ""
cat "$KEY_PATH"
echo ""
sep
log "Listo. Una vez que pegues el secret SSH_PRIVATE_KEY en GitHub el deploy automático funcionará."
sep
