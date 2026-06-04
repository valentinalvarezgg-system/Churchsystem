-- ============================================================
-- MIGRACIÓN v3.0 — Árbol de discipulado
-- Tabla: DiscipuladoRelacion
-- Registra quién discipuló a quién dentro de una iglesia
-- ============================================================

CREATE TABLE IF NOT EXISTS "DiscipuladoRelacion" (
  "id"           SERIAL PRIMARY KEY,
  "iglesiaId"    INT NOT NULL,
  "discipuladorId" INT NOT NULL,   -- persona que discipula
  "discipuladoId"  INT NOT NULL,   -- persona que es discipulada
  "fechaInicio"  DATE,
  "activo"       BOOLEAN NOT NULL DEFAULT true,
  "notas"        TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "DiscipuladoRelacion_iglesia_fk"
    FOREIGN KEY ("iglesiaId") REFERENCES "Iglesia"("id") ON DELETE CASCADE,
  CONSTRAINT "DiscipuladoRelacion_discipulador_fk"
    FOREIGN KEY ("discipuladorId") REFERENCES "Persona"("id") ON DELETE CASCADE,
  CONSTRAINT "DiscipuladoRelacion_discipulado_fk"
    FOREIGN KEY ("discipuladoId") REFERENCES "Persona"("id") ON DELETE CASCADE,

  -- Una persona solo puede ser discipulada por una sola persona a la vez (activo)
  CONSTRAINT "DiscipuladoRelacion_unique_activo"
    UNIQUE ("iglesiaId", "discipuladoId", "activo")
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS "DiscipuladoRelacion_iglesia_idx"
  ON "DiscipuladoRelacion"("iglesiaId");
CREATE INDEX IF NOT EXISTS "DiscipuladoRelacion_discipulador_idx"
  ON "DiscipuladoRelacion"("discipuladorId");
CREATE INDEX IF NOT EXISTS "DiscipuladoRelacion_discipulado_idx"
  ON "DiscipuladoRelacion"("discipuladoId");
