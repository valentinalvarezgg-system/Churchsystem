ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "cultoDia" TEXT DEFAULT '';
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "cultoTurno" INTEGER DEFAULT 0;
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "grupoId" INTEGER;
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "notas" TEXT DEFAULT '';
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "fechaIngreso" TEXT;
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "fechaNacimiento" TEXT;
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "estadoEspiritual" TEXT DEFAULT 'NUEVO_CREYENTE';
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "bautizadoAgua" BOOLEAN DEFAULT false;
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "bautizadoEspiritu" BOOLEAN DEFAULT false;
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "discipuladoCompletado" BOOLEAN DEFAULT false;
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "ocupacion" TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS "Grupo" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "cultoDia" TEXT DEFAULT '',
  "cultoTurno" INTEGER DEFAULT 0,
  "liderId" INTEGER,
  "descripcion" TEXT DEFAULT '',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Grupo_iglesiaId_idx" ON "Grupo"("iglesiaId");
CREATE INDEX IF NOT EXISTS "Grupo_liderId_idx" ON "Grupo"("liderId");
CREATE INDEX IF NOT EXISTS "Persona_grupoId_idx" ON "Persona"("grupoId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Grupo_iglesiaId_fkey'
  ) THEN
    ALTER TABLE "Grupo"
      ADD CONSTRAINT "Grupo_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
