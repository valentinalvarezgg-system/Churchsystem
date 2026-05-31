# Church System — Deploy & Setup

## Arquitectura

```
GitHub (master)
    │
    └─► GitHub Actions (build + deploy)
              │
              └─► VPS via SSH
                    /var/www/church-system
                    ├── backend/   (Node + Express)
                    ├── frontend/  (React + Vite → dist/)
                    └── .env       (secretos, nunca en git)

nginx → :80/:443   →  frontend/dist/  (archivos estáticos)
                   →  :4000           (proxy /api/* al backend)
PM2 gestiona el proceso Node
```

---

## Primer setup (solo una vez)

### 1 — Desde tu Mac: generar clave SSH de deploy

```bash
chmod +x scripts/setup-ssh-mac.sh
# Editá SSH_HOST dentro del script con la IP de tu servidor
./scripts/setup-ssh-mac.sh
```

El script:
- Genera `~/.ssh/church-system-deploy` (ed25519)
- La copia al servidor vía `ssh-copy-id`
- Imprime la clave privada para pegar en GitHub Secrets

### 2 — En el servidor: provisionar

```bash
# Conectate al servidor
ssh Valentin@TU_IP

# Descargar y ejecutar el script de setup
curl -fsSL https://raw.githubusercontent.com/valentinalvarezgg-system/churchsystem/master/scripts/setup-server.sh | bash
```

El script instala: `git`, `Node 20`, `pnpm`, `pm2`, `nginx`, clona el repo, hace el primer build y levanta el proceso.

### 3 — GitHub Secrets

Ir a `Settings → Secrets and variables → Actions → New repository secret`:

| Secret | Valor |
|--------|-------|
| `SSH_HOST` | IP o dominio del servidor |
| `SSH_USER` | `Valentin` |
| `SSH_PORT` | `22` (o el puerto SSH que uses) |
| `SSH_PRIVATE_KEY` | Contenido de `~/.ssh/church-deploy` (impreso por `setup-ssh-mac.sh`) |

### 4 — Variables de entorno en el servidor

Editá `/var/www/church-system/backend/.env`:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<generar con: openssl rand -hex 32>

# Email
RESEND_API_KEY=<de resend.com>
EMAIL_FROM=noreply@tudominio.com

# MercadoPago
MP_ACCESS_TOKEN=<de mercadopago>
MP_WEBHOOK_SECRET=<de mercadopago>

# Google OAuth
GOOGLE_CLIENT_ID=<de google cloud console>
GOOGLE_CLIENT_SECRET=<de google cloud console>
GOOGLE_CALLBACK_URL=https://tudominio.com/auth/google/callback

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENV=live

# Transferencia manual
TRANSFERENCIA_BANCO=Banco Ejemplo
TRANSFERENCIA_ALIAS=church.system
TRANSFERENCIA_CBU=0000000000000000000000
TRANSFERENCIA_TITULAR=Nombre Titular
TRANSFERENCIA_CUIT=20-12345678-9

# Reportes
OWNER_REPORTS_EMAIL=admin@tudominio.com
SUPPORT_EMAIL=soporte@tudominio.com

# QR permanentes
QR_SECRET=<generar con: openssl rand -hex 32>

# CORS
FRONTEND_URL=https://tudominio.com
```

Después de editarlo:
```bash
pm2 restart church-system --update-env
```

### 5 — SSL con Let's Encrypt

```bash
# Reemplazá tudominio.com con tu dominio real
certbot --nginx -d tudominio.com -d www.tudominio.com
```

---

## Deploy automático (flujo normal)

Cada `git push origin master` dispara GitHub Actions automáticamente:

1. **Build job**: instala deps + `pnpm build` del frontend en Ubuntu runner
2. **Deploy job**: SSH al servidor → `git pull` → instala deps → `pm2 restart`

El `frontend/dist/` también está commiteado en git por seguridad (Render lo sirve directamente), así que el deploy funciona aunque Actions falle.

### Forzar deploy manual desde el servidor

```bash
ssh root@TU_IP
cd /var/www/church-system
git pull origin master
cd backend && pnpm install
cd ../frontend && pnpm install && pnpm build
pm2 restart church-system
```

---

## Diagnóstico

```bash
# Estado completo
bash scripts/diagnostico.sh

# Con logs
bash scripts/diagnostico.sh --logs

# PM2 interactivo
pm2 monit

# Logs en tiempo real
pm2 logs church-system
```

---

## Rollback

```bash
ssh root@TU_IP
cd /var/www/church-system

# Ver commits recientes
git log --oneline -10

# Volver a un commit específico
git checkout <hash-del-commit>
pm2 restart church-system

# Para volver al estado normal:
git checkout master
git pull origin master
pm2 restart church-system
```

---

## Estructura del deploy.yml

```
.github/workflows/deploy.yml
├── on: push to master
├── job: build
│   ├── checkout
│   ├── setup Node 20
│   ├── pnpm install + pnpm build (frontend)
│   └── upload artifact (frontend/dist)
└── job: deploy (needs: build)
    ├── checkout
    ├── download artifact (frontend/dist)
    └── SSH action → servidor
        ├── cd /var/www/church-system
        ├── git pull origin master
        ├── cd frontend && pnpm install && pnpm build
        ├── cd ../backend && pnpm install
        └── pm2 restart church-system || pm2 start ...
```

---

## Troubleshooting común

| Problema | Causa probable | Fix |
|----------|---------------|-----|
| Deploy falla con "Permission denied (publickey)" | SSH_PRIVATE_KEY mal copiado | Copiar el contenido completo incluyendo `-----BEGIN/END-----` |
| App no arranca tras deploy | .env faltante o incompleto | `cat /var/www/church-system/backend/.env` |
| Frontend no actualiza | dist/ no commiteado | `cd frontend && pnpm build && cd .. && git add frontend/dist/ && git commit` |
| Puerto 4000 no responde | PM2 caído | `pm2 list` → `pm2 restart church-system` |
| Error 502 en nginx | App no está en :4000 | `pm2 logs church-system` para ver el error |
| Base de datos no conecta | DATABASE_URL incorrecta | Verificar con `psql $DATABASE_URL` |
| Stripe webhooks no llegan | STRIPE_WEBHOOK_SECRET mal | Verificar en Stripe Dashboard → Webhooks |
