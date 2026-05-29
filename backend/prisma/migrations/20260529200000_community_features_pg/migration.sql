-- Comunicados
CREATE TABLE IF NOT EXISTS "Comunicado" (
  "id"           SERIAL PRIMARY KEY,
  "iglesiaId"    INTEGER NOT NULL,
  "userId"       INTEGER,
  "titulo"       TEXT NOT NULL,
  "contenido"    TEXT NOT NULL,
  "tipo"         TEXT NOT NULL DEFAULT 'GENERAL',
  "destinatarios" TEXT NOT NULL DEFAULT 'TODOS',
  "fijado"       BOOLEAN NOT NULL DEFAULT false,
  "archivado"    BOOLEAN NOT NULL DEFAULT false,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Comunicado_iglesiaId_idx" ON "Comunicado"("iglesiaId");

-- Eventos
CREATE TABLE IF NOT EXISTS "Evento" (
  "id"          SERIAL PRIMARY KEY,
  "iglesiaId"   INTEGER NOT NULL,
  "userId"      INTEGER,
  "titulo"      TEXT NOT NULL,
  "tipo"        TEXT NOT NULL DEFAULT 'EVENTO',
  "fecha"       TEXT NOT NULL,
  "hora"        TEXT NOT NULL DEFAULT '',
  "lugar"       TEXT NOT NULL DEFAULT '',
  "descripcion" TEXT NOT NULL DEFAULT '',
  "todoElDia"   BOOLEAN NOT NULL DEFAULT false,
  "deletedAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Evento_iglesiaId_idx" ON "Evento"("iglesiaId");
CREATE INDEX IF NOT EXISTS "Evento_fecha_idx" ON "Evento"("fecha");

-- Oracion / Peticiones de oración
CREATE TABLE IF NOT EXISTS "Oracion" (
  "id"          SERIAL PRIMARY KEY,
  "iglesiaId"   INTEGER NOT NULL,
  "userId"      INTEGER,
  "titulo"      TEXT NOT NULL,
  "descripcion" TEXT NOT NULL DEFAULT '',
  "privado"     BOOLEAN NOT NULL DEFAULT false,
  "estado"      TEXT NOT NULL DEFAULT 'ACTIVA',
  "deletedAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Oracion_iglesiaId_idx" ON "Oracion"("iglesiaId");

CREATE TABLE IF NOT EXISTS "OracionApoyo" (
  "id"        SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER NOT NULL,
  "oracionId" INTEGER NOT NULL,
  "userId"    INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("oracionId","userId")
);
CREATE INDEX IF NOT EXISTS "OracionApoyo_iglesiaId_idx" ON "OracionApoyo"("iglesiaId");
CREATE INDEX IF NOT EXISTS "OracionApoyo_oracionId_idx" ON "OracionApoyo"("oracionId");

-- Consolidación de visitantes
CREATE TABLE IF NOT EXISTS "Consolidacion" (
  "id"             SERIAL PRIMARY KEY,
  "iglesiaId"      INTEGER NOT NULL,
  "personaId"      INTEGER NOT NULL,
  "consolidadorId" INTEGER,
  "estado"         TEXT NOT NULL DEFAULT 'PRIMER_CONTACTO',
  "pasos"          TEXT NOT NULL DEFAULT '{}',
  "notas"          TEXT NOT NULL DEFAULT '',
  "deletedAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Consolidacion_iglesiaId_idx" ON "Consolidacion"("iglesiaId");
CREATE INDEX IF NOT EXISTS "Consolidacion_personaId_idx" ON "Consolidacion"("personaId");

-- Discipulado — progreso por material
CREATE TABLE IF NOT EXISTS "DiscipuladoProg" (
  "id"         SERIAL PRIMARY KEY,
  "iglesiaId"  INTEGER NOT NULL,
  "personaId"  INTEGER NOT NULL,
  "material"   TEXT NOT NULL,
  "completado" BOOLEAN NOT NULL DEFAULT false,
  "fecha"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("personaId","material")
);
CREATE INDEX IF NOT EXISTS "DiscipuladoProg_iglesiaId_idx" ON "DiscipuladoProg"("iglesiaId");
CREATE INDEX IF NOT EXISTS "DiscipuladoProg_personaId_idx" ON "DiscipuladoProg"("personaId");

-- Familiares
CREATE TABLE IF NOT EXISTS "Familiar" (
  "id"         SERIAL PRIMARY KEY,
  "iglesiaId"  INTEGER NOT NULL,
  "personaId"  INTEGER NOT NULL,
  "familiarId" INTEGER NOT NULL,
  "relacion"   TEXT NOT NULL DEFAULT 'otro',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("personaId","familiarId")
);
CREATE INDEX IF NOT EXISTS "Familiar_iglesiaId_idx" ON "Familiar"("iglesiaId");
CREATE INDEX IF NOT EXISTS "Familiar_personaId_idx" ON "Familiar"("personaId");

-- Contactos extra (WhatsApp alt, Instagram, Telegram, etc.)
CREATE TABLE IF NOT EXISTS "ContactoExtra" (
  "id"          SERIAL PRIMARY KEY,
  "iglesiaId"   INTEGER NOT NULL,
  "personaId"   INTEGER NOT NULL,
  "tipo"        TEXT NOT NULL,
  "valor"       TEXT NOT NULL,
  "descripcion" TEXT NOT NULL DEFAULT '',
  "principal"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ContactoExtra_iglesiaId_idx" ON "ContactoExtra"("iglesiaId");
CREATE INDEX IF NOT EXISTS "ContactoExtra_personaId_idx" ON "ContactoExtra"("personaId");

-- Origen / primera visita
CREATE TABLE IF NOT EXISTS "VisitaOrigen" (
  "id"               SERIAL PRIMARY KEY,
  "iglesiaId"        INTEGER NOT NULL,
  "personaId"        INTEGER NOT NULL UNIQUE,
  "traidoPorId"      INTEGER,
  "traidoPorNombre"  TEXT NOT NULL DEFAULT '',
  "cultoId"          INTEGER,
  "cultoNombre"      TEXT NOT NULL DEFAULT '',
  "fecha"            TEXT NOT NULL DEFAULT '',
  "notas"            TEXT NOT NULL DEFAULT '',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "VisitaOrigen_iglesiaId_idx" ON "VisitaOrigen"("iglesiaId");
CREATE INDEX IF NOT EXISTS "VisitaOrigen_personaId_idx" ON "VisitaOrigen"("personaId");

-- FK constraints con DO $$ para evitar fallo si ya existen
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Comunicado_iglesiaId_fkey') THEN
    ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Evento_iglesiaId_fkey') THEN
    ALTER TABLE "Evento" ADD CONSTRAINT "Evento_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Oracion_iglesiaId_fkey') THEN
    ALTER TABLE "Oracion" ADD CONSTRAINT "Oracion_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OracionApoyo_iglesiaId_fkey') THEN
    ALTER TABLE "OracionApoyo" ADD CONSTRAINT "OracionApoyo_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Consolidacion_iglesiaId_fkey') THEN
    ALTER TABLE "Consolidacion" ADD CONSTRAINT "Consolidacion_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Consolidacion_personaId_fkey') THEN
    ALTER TABLE "Consolidacion" ADD CONSTRAINT "Consolidacion_personaId_fkey"
      FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscipuladoProg_iglesiaId_fkey') THEN
    ALTER TABLE "DiscipuladoProg" ADD CONSTRAINT "DiscipuladoProg_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiscipuladoProg_personaId_fkey') THEN
    ALTER TABLE "DiscipuladoProg" ADD CONSTRAINT "DiscipuladoProg_personaId_fkey"
      FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Familiar_iglesiaId_fkey') THEN
    ALTER TABLE "Familiar" ADD CONSTRAINT "Familiar_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Familiar_personaId_fkey') THEN
    ALTER TABLE "Familiar" ADD CONSTRAINT "Familiar_personaId_fkey"
      FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactoExtra_iglesiaId_fkey') THEN
    ALTER TABLE "ContactoExtra" ADD CONSTRAINT "ContactoExtra_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContactoExtra_personaId_fkey') THEN
    ALTER TABLE "ContactoExtra" ADD CONSTRAINT "ContactoExtra_personaId_fkey"
      FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VisitaOrigen_iglesiaId_fkey') THEN
    ALTER TABLE "VisitaOrigen" ADD CONSTRAINT "VisitaOrigen_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VisitaOrigen_personaId_fkey') THEN
    ALTER TABLE "VisitaOrigen" ADD CONSTRAINT "VisitaOrigen_personaId_fkey"
      FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
