CREATE TABLE IF NOT EXISTS "Mensaje" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER NOT NULL,
  "personaId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'WHATSAPP',
  "destino" TEXT NOT NULL DEFAULT '',
  "mensaje" TEXT NOT NULL,
  "enviado" BOOLEAN NOT NULL DEFAULT false,
  "error" TEXT,
  "plantillaId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PlantillaMensaje" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER NOT NULL,
  "nombre" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'WHATSAPP',
  "contenido" TEXT NOT NULL,
  "userId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "endpoint" TEXT NOT NULL UNIQUE,
  "keys" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Permiso" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL UNIQUE,
  "personas" INTEGER NOT NULL DEFAULT 0,
  "grupos" INTEGER NOT NULL DEFAULT 0,
  "asistencia" INTEGER NOT NULL DEFAULT 0,
  "calendario" INTEGER NOT NULL DEFAULT 0,
  "mensajes" INTEGER NOT NULL DEFAULT 0,
  "alertas" INTEGER NOT NULL DEFAULT 0,
  "finanzas" INTEGER NOT NULL DEFAULT 0,
  "reportes" INTEGER NOT NULL DEFAULT 0,
  "discipulado" INTEGER NOT NULL DEFAULT 0,
  "seguimiento" INTEGER NOT NULL DEFAULT 0,
  "historial" INTEGER NOT NULL DEFAULT 0,
  "consolidacion" INTEGER NOT NULL DEFAULT 0,
  "oracion" INTEGER NOT NULL DEFAULT 0,
  "comunicados" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Mensaje_iglesiaId_idx" ON "Mensaje"("iglesiaId");
CREATE INDEX IF NOT EXISTS "Mensaje_personaId_idx" ON "Mensaje"("personaId");
CREATE INDEX IF NOT EXISTS "Mensaje_userId_idx" ON "Mensaje"("userId");
CREATE INDEX IF NOT EXISTS "PlantillaMensaje_iglesiaId_idx" ON "PlantillaMensaje"("iglesiaId");
CREATE INDEX IF NOT EXISTS "PushSubscription_iglesiaId_idx" ON "PushSubscription"("iglesiaId");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX IF NOT EXISTS "Permiso_iglesiaId_idx" ON "Permiso"("iglesiaId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mensaje_iglesiaId_fkey') THEN
    ALTER TABLE "Mensaje"
      ADD CONSTRAINT "Mensaje_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mensaje_personaId_fkey') THEN
    ALTER TABLE "Mensaje"
      ADD CONSTRAINT "Mensaje_personaId_fkey"
      FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlantillaMensaje_iglesiaId_fkey') THEN
    ALTER TABLE "PlantillaMensaje"
      ADD CONSTRAINT "PlantillaMensaje_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_iglesiaId_fkey') THEN
    ALTER TABLE "PushSubscription"
      ADD CONSTRAINT "PushSubscription_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Permiso_iglesiaId_fkey') THEN
    ALTER TABLE "Permiso"
      ADD CONSTRAINT "Permiso_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
