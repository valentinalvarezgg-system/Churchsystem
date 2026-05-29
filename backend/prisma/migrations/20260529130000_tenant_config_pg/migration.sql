CREATE TABLE IF NOT EXISTS "Configuracion" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INTEGER,
  "clave" TEXT NOT NULL,
  "valor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Configuracion_iglesiaId_idx" ON "Configuracion"("iglesiaId");
CREATE INDEX IF NOT EXISTS "Configuracion_clave_idx" ON "Configuracion"("clave");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Configuracion_iglesiaId_fkey'
  ) THEN
    ALTER TABLE "Configuracion"
      ADD CONSTRAINT "Configuracion_iglesiaId_fkey"
      FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'Configuracion_iglesiaId_clave_key'
  ) THEN
    CREATE UNIQUE INDEX "Configuracion_iglesiaId_clave_key"
      ON "Configuracion"("iglesiaId","clave");
  END IF;
END $$;
