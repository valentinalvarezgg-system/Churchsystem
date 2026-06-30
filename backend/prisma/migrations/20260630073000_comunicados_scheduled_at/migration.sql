ALTER TABLE "Comunicado"
ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "Comunicado_visible_idx"
ON "Comunicado"("iglesiaId", "scheduledAt", "fijado" DESC, "id" DESC)
WHERE "archivado" = false;

CREATE INDEX IF NOT EXISTS "Comunicado_programados_idx"
ON "Comunicado"("iglesiaId", "scheduledAt")
WHERE "archivado" = false AND "scheduledAt" IS NOT NULL;
