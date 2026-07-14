CREATE TABLE IF NOT EXISTS "InventarioSeccion" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "orden" INT NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "InventarioItem" (
  "id" SERIAL PRIMARY KEY,
  "iglesiaId" INT NOT NULL,
  "seccionId" INT NOT NULL REFERENCES "InventarioSeccion"("id"),
  "nombre" TEXT NOT NULL,
  "codigo" TEXT,
  "cantidad" INT NOT NULL DEFAULT 0 CHECK ("cantidad" >= 0),
  "stockMinimo" INT NOT NULL DEFAULT 0 CHECK ("stockMinimo" >= 0),
  "estado" TEXT NOT NULL DEFAULT 'BUENO',
  "ubicacion" TEXT,
  "responsable" TEXT,
  "observaciones" TEXT,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "InventarioSeccion_iglesia_idx" ON "InventarioSeccion"("iglesiaId") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "InventarioItem_iglesia_seccion_idx" ON "InventarioItem"("iglesiaId", "seccionId") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "InventarioSeccion_nombre_uq" ON "InventarioSeccion"("iglesiaId", LOWER("nombre")) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "InventarioItem_codigo_uq" ON "InventarioItem"("iglesiaId", LOWER("codigo")) WHERE "deletedAt" IS NULL AND "codigo" IS NOT NULL;
