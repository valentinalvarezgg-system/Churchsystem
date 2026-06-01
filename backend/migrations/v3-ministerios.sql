-- ============================================================
-- MIGRACIÓN v3.0 Sprint 1 — Módulo de Ministerios
-- Church System — Multi-tenant por iglesiaId
-- ============================================================

-- ── 1. Tipos de ministerio (16 built-in + personalizado) ────
CREATE TYPE "MinisterioTipo" AS ENUM (
  'ALABANZA', 'SONIDO', 'PROYECCION', 'UJIERES', 'NINOS',
  'JUVENTUD', 'EVANGELISMO', 'CONSOLIDACION_MIN', 'VOLUNTARIADO',
  'COMUNICACIONES', 'ADMINISTRACION', 'ORACION_CUIDADO',
  'EVENTOS_CAMPANAS', 'MANTENIMIENTO', 'SEGURIDAD', 'PERSONALIZADO'
);

CREATE TYPE "RolMinisterio" AS ENUM ('COORDINADOR', 'LIDER', 'SERVIDOR', 'LECTURA');
CREATE TYPE "TareaEstado" AS ENUM ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA');
CREATE TYPE "TareaPrioridad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- ── Ministerio ───────────────────────────────────────────────
CREATE TABLE "Ministerio" (
  "id"               SERIAL PRIMARY KEY,
  "iglesiaId"        INT NOT NULL REFERENCES "Iglesia"("id") ON DELETE CASCADE,
  "tipo"             "MinisterioTipo" NOT NULL DEFAULT 'PERSONALIZADO',
  "nombre"           VARCHAR(120) NOT NULL,
  "descripcion"      TEXT,
  "icono"            VARCHAR(10),
  "color"            VARCHAR(20),
  "activo"           BOOLEAN NOT NULL DEFAULT TRUE,
  "orden"            INT NOT NULL DEFAULT 0,
  "esDePlantilla"    BOOLEAN NOT NULL DEFAULT FALSE,
  "plantillaOrigen"  INT REFERENCES "Ministerio"("id"),
  "deletedAt"        TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Ministerio_iglesiaId_idx" ON "Ministerio"("iglesiaId");

-- ── MinisterioMiembro ────────────────────────────────────────
CREATE TABLE "MinisterioMiembro" (
  "id"           SERIAL PRIMARY KEY,
  "ministerioId" INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE,
  "userId"       INT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "personaId"    INT REFERENCES "Persona"("id") ON DELETE SET NULL,
  "rol"          "RolMinisterio" NOT NULL DEFAULT 'SERVIDOR',
  "activo"       BOOLEAN NOT NULL DEFAULT TRUE,
  "notas"        TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("ministerioId", "userId")
);
CREATE INDEX "MinisterioMiembro_ministerioId_idx" ON "MinisterioMiembro"("ministerioId");
CREATE INDEX "MinisterioMiembro_userId_idx" ON "MinisterioMiembro"("userId");

-- ── MinisterioPermiso ────────────────────────────────────────
CREATE TABLE "MinisterioPermiso" (
  "id"              SERIAL PRIMARY KEY,
  "ministerioId"    INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE,
  "miembroId"       INT NOT NULL REFERENCES "MinisterioMiembro"("id") ON DELETE CASCADE,
  "verPanel"        BOOLEAN NOT NULL DEFAULT TRUE,
  "editarInfo"      BOOLEAN NOT NULL DEFAULT FALSE,
  "crearTareas"     BOOLEAN NOT NULL DEFAULT FALSE,
  "asignarPersonas" BOOLEAN NOT NULL DEFAULT FALSE,
  "aprobarItems"    BOOLEAN NOT NULL DEFAULT FALSE,
  "cerrarItems"     BOOLEAN NOT NULL DEFAULT FALSE,
  "verReportes"     BOOLEAN NOT NULL DEFAULT FALSE,
  "adminMinisterio" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("ministerioId", "miembroId")
);

-- ── MinisterioTarea ──────────────────────────────────────────
CREATE TABLE "MinisterioTarea" (
  "id"             SERIAL PRIMARY KEY,
  "ministerioId"   INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE,
  "iglesiaId"      INT NOT NULL,
  "titulo"         VARCHAR(200) NOT NULL,
  "descripcion"    TEXT,
  "estado"         "TareaEstado" NOT NULL DEFAULT 'PENDIENTE',
  "prioridad"      "TareaPrioridad" NOT NULL DEFAULT 'MEDIA',
  "asignadoA"      INT REFERENCES "User"("id") ON DELETE SET NULL,
  "creadoPor"      INT REFERENCES "User"("id") ON DELETE SET NULL,
  "eventoId"       INT REFERENCES "Evento"("id") ON DELETE SET NULL,
  "fechaVence"     TIMESTAMPTZ,
  "fechaCompletada" TIMESTAMPTZ,
  "orden"          INT NOT NULL DEFAULT 0,
  "deletedAt"      TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MinisterioTarea_ministerioId_idx" ON "MinisterioTarea"("ministerioId");
CREATE INDEX "MinisterioTarea_asignadoA_idx" ON "MinisterioTarea"("asignadoA");
CREATE INDEX "MinisterioTarea_estado_idx" ON "MinisterioTarea"("estado");

-- ── Checklists ───────────────────────────────────────────────
CREATE TABLE "MinisterioChecklist" (
  "id"            SERIAL PRIMARY KEY,
  "ministerioId"  INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE,
  "nombre"        VARCHAR(150) NOT NULL,
  "tipo"          VARCHAR(50) NOT NULL DEFAULT 'CULTO',
  "eventoId"      INT REFERENCES "Evento"("id") ON DELETE SET NULL,
  "completado"    BOOLEAN NOT NULL DEFAULT FALSE,
  "completadoAt"  TIMESTAMPTZ,
  "completadoPor" INT REFERENCES "User"("id") ON DELETE SET NULL,
  "deletedAt"     TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "MinisterioChecklistItem" (
  "id"          SERIAL PRIMARY KEY,
  "checklistId" INT NOT NULL REFERENCES "MinisterioChecklist"("id") ON DELETE CASCADE,
  "texto"       VARCHAR(300) NOT NULL,
  "completado"  BOOLEAN NOT NULL DEFAULT FALSE,
  "orden"       INT NOT NULL DEFAULT 0,
  "notas"       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Configuración específica (JSON por tipo) ─────────────────
CREATE TABLE "MinisterioConfig" (
  "id"           SERIAL PRIMARY KEY,
  "ministerioId" INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE UNIQUE,
  "datos"        JSONB NOT NULL DEFAULT '{}',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Auditoría ────────────────────────────────────────────────
CREATE TABLE "MinisterioAudit" (
  "id"           SERIAL PRIMARY KEY,
  "ministerioId" INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE,
  "iglesiaId"    INT NOT NULL,
  "userId"       INT REFERENCES "User"("id") ON DELETE SET NULL,
  "accion"       VARCHAR(100) NOT NULL,
  "entidad"      VARCHAR(100),
  "entidadId"    INT,
  "datos"        JSONB,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MinisterioAudit_iglesiaId_idx" ON "MinisterioAudit"("iglesiaId");

-- ── Módulos específicos ──────────────────────────────────────

-- ALABANZA: Repertorio
CREATE TABLE "MinisterioCancion" (
  "id"           SERIAL PRIMARY KEY,
  "ministerioId" INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE,
  "titulo"       VARCHAR(200) NOT NULL,
  "artista"      VARCHAR(150),
  "tonalidad"    VARCHAR(10),
  "bpm"          INT,
  "duracionSeg"  INT,
  "letra"        TEXT,
  "notas"        TEXT,
  "archivoUrl"   TEXT,
  "activa"       BOOLEAN NOT NULL DEFAULT TRUE,
  "deletedAt"    TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MinisterioCancion_ministerioId_idx" ON "MinisterioCancion"("ministerioId");

-- ALABANZA: Setlists
CREATE TABLE "MinisterioSetlist" (
  "id"           SERIAL PRIMARY KEY,
  "ministerioId" INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE,
  "eventoId"     INT REFERENCES "Evento"("id") ON DELETE SET NULL,
  "nombre"       VARCHAR(150) NOT NULL,
  "fecha"        DATE,
  "notas"        TEXT,
  "aprobado"     BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "MinisterioSetlistCancion" (
  "id"          SERIAL PRIMARY KEY,
  "setlistId"   INT NOT NULL REFERENCES "MinisterioSetlist"("id") ON DELETE CASCADE,
  "cancionId"   INT NOT NULL REFERENCES "MinisterioCancion"("id") ON DELETE CASCADE,
  "orden"       INT NOT NULL DEFAULT 0,
  "tonalidad"   VARCHAR(10),
  "notas"       TEXT
);

-- SONIDO / MULTIMEDIA: Equipos
CREATE TABLE "MinisterioEquipo" (
  "id"           SERIAL PRIMARY KEY,
  "ministerioId" INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE,
  "nombre"       VARCHAR(200) NOT NULL,
  "tipo"         VARCHAR(100),
  "marca"        VARCHAR(100),
  "modelo"       VARCHAR(100),
  "serial"       VARCHAR(150),
  "estado"       VARCHAR(50) NOT NULL DEFAULT 'OPERATIVO',
  "ubicacion"    VARCHAR(200),
  "notas"        TEXT,
  "deletedAt"    TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MinisterioEquipo_ministerioId_idx" ON "MinisterioEquipo"("ministerioId");

-- NIÑOS: Salas
CREATE TABLE "MinisterioSala" (
  "id"           SERIAL PRIMARY KEY,
  "ministerioId" INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE,
  "nombre"       VARCHAR(100) NOT NULL,
  "rangoEdadMin" INT,
  "rangoEdadMax" INT,
  "capacidad"    INT,
  "activa"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- NIÑOS: Check-in con seguridad
CREATE TABLE "MinisterioCheckInNino" (
  "id"                   SERIAL PRIMARY KEY,
  "ministerioId"         INT NOT NULL REFERENCES "Ministerio"("id") ON DELETE CASCADE,
  "salaId"               INT REFERENCES "MinisterioSala"("id") ON DELETE SET NULL,
  "personaId"            INT REFERENCES "Persona"("id") ON DELETE CASCADE,
  "eventoId"             INT REFERENCES "Evento"("id") ON DELETE SET NULL,
  "horaEntrada"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "horaSalida"           TIMESTAMPTZ,
  "responsableEntregaId" INT REFERENCES "Persona"("id") ON DELETE SET NULL,
  "codigoRetiro"         VARCHAR(20),
  "notas"                TEXT,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MinisterioCheckInNino_ministerioId_idx" ON "MinisterioCheckInNino"("ministerioId");
