CREATE TABLE IF NOT EXISTS "Culto" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "fecha" TEXT NOT NULL,
  "cultoDia" TEXT DEFAULT '',
  "cultoTurno" INTEGER DEFAULT 0,
  "observaciones" TEXT DEFAULT '',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Asistencia" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER NOT NULL,
  "cultoId" INTEGER NOT NULL,
  "personaId" INTEGER NOT NULL,
  "presente" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("cultoId","personaId")
);

CREATE TABLE IF NOT EXISTS "Seguimiento" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER NOT NULL,
  "personaId" INTEGER NOT NULL,
  "userId" INTEGER,
  "tipo" TEXT DEFAULT 'CONTACTO',
  "nota" TEXT DEFAULT '',
  "proximoContacto" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Finanza" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER NOT NULL,
  "monto" DOUBLE PRECISION NOT NULL,
  "tipo" TEXT DEFAULT 'OFRENDA',
  "fecha" TEXT NOT NULL,
  "cultoId" INTEGER,
  "descripcion" TEXT DEFAULT '',
  "anonimo" BOOLEAN NOT NULL DEFAULT true,
  "userId" INTEGER,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Culto_iglesiaId_idx" ON "Culto"("iglesiaId");
CREATE INDEX IF NOT EXISTS "Asistencia_iglesiaId_idx" ON "Asistencia"("iglesiaId");
CREATE INDEX IF NOT EXISTS "Asistencia_cultoId_idx" ON "Asistencia"("cultoId");
CREATE INDEX IF NOT EXISTS "Asistencia_personaId_idx" ON "Asistencia"("personaId");
CREATE INDEX IF NOT EXISTS "Seguimiento_iglesiaId_idx" ON "Seguimiento"("iglesiaId");
CREATE INDEX IF NOT EXISTS "Seguimiento_personaId_idx" ON "Seguimiento"("personaId");
CREATE INDEX IF NOT EXISTS "Finanza_iglesiaId_idx" ON "Finanza"("iglesiaId");
CREATE INDEX IF NOT EXISTS "Finanza_fecha_idx" ON "Finanza"("fecha");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Culto_iglesiaId_fkey') THEN
    ALTER TABLE "Culto" ADD CONSTRAINT "Culto_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Asistencia_iglesiaId_fkey') THEN
    ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Asistencia_cultoId_fkey') THEN
    ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_cultoId_fkey"
      FOREIGN KEY ("cultoId") REFERENCES "Culto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Asistencia_personaId_fkey') THEN
    ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_personaId_fkey"
      FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Seguimiento_iglesiaId_fkey') THEN
    ALTER TABLE "Seguimiento" ADD CONSTRAINT "Seguimiento_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Seguimiento_personaId_fkey') THEN
    ALTER TABLE "Seguimiento" ADD CONSTRAINT "Seguimiento_personaId_fkey"
      FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Finanza_iglesiaId_fkey') THEN
    ALTER TABLE "Finanza" ADD CONSTRAINT "Finanza_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
