#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups/postgres"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"

if [[ -f "$ROOT_DIR/.env" && -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT_DIR/.env" | tail -n 1 | cut -d '=' -f2- || true)"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL no configurado"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

OUT_FILE="$BACKUP_DIR/churchsystem_${TIMESTAMP}.sql.gz"
TMP_FILE="$BACKUP_DIR/churchsystem_${TIMESTAMP}.sql"

echo "Iniciando backup PostgreSQL..."
if command -v docker >/dev/null 2>&1; then
  docker run --rm \
    -e "DATABASE_URL=$DATABASE_URL" \
    -v "$BACKUP_DIR:/backup" \
    postgres:18 \
    bash -lc "pg_dump \"\$DATABASE_URL\" --no-owner --no-privileges --format=plain --file=\"/backup/churchsystem_${TIMESTAMP}.sql\""
else
  pg_dump "$DATABASE_URL" --no-owner --no-privileges --format=plain --file="$TMP_FILE"
fi

if [[ ! -f "$TMP_FILE" ]]; then
  echo "ERROR: no se genero el dump SQL"
  exit 1
fi

gzip -f "$TMP_FILE"

echo "Backup generado: $OUT_FILE"

find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
echo "Retencion aplicada: $RETENTION_DAYS dias"
