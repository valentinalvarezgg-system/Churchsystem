# ChurchSystem - Auditoria Total (Dia 1)

Fecha: 2026-05-29  
Branch: `stabilization-v1`  
Objetivo de esta auditoria: identificar bloqueos para vender con confianza y estabilizar el core.

## 1) Bugs Criticos (bloquean comercializacion)

1. Seguridad de autenticacion con defaults inseguros.
Evidencia:
- `JWT_SECRET || 'dev'` en [auth.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/routes/auth.js), [oauth.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/routes/oauth.js), [middlewares/auth.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/middlewares/auth.js).
- Secret de QR hardcodeado en [checkin.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/routes/checkin.js).
Riesgo: bypass de seguridad, firma JWT predecible, fuga de acceso multi-tenant.

2. CORS abierto en produccion.
Evidencia:
- `cb(null, true)` en [server.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/server.js).
Riesgo: cualquier origen puede consumir APIs autenticadas.

3. Persistencia principal en `sql.js` local.
Evidencia:
- dependencia `sql.js` en [package.json](/Users/Valentin/Desktop/church-system-alpha/backend/package.json).
- uso central en [db.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/lib/db.js) y [tenant.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/middlewares/tenant.js).
Riesgo: alta fragilidad operativa, concurrencia limitada, riesgo de corrupcion y bloqueo al escalar.

4. Datos sensibles y secretos en backups dentro del repo de trabajo.
Evidencia:
- `backup/env-backup/backend.env`, `backup/env-backup/frontend.env`, `backup/project.zip`.
Riesgo: exposicion accidental de secretos y credenciales.

5. Logs de aplicacion con `console.log` en runtime.
Evidencia:
- multiples `console.log` en [server.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/server.js), [notificaciones.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/routes/notificaciones.js), [mercadopago.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/routes/mercadopago.js), [tenant.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/middlewares/tenant.js).
Riesgo: observabilidad no estructurada, dificultad de soporte, ruido y fuga de datos.

## 2) Bugs Mayores (afectan confianza y onboarding)

1. Multi-tenant incompleto y heterogeneo.
Evidencia:
- existe `tenantMiddleware` pero no se aplica globalmente en [server.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/server.js).
- muchas rutas siguen usando `db` global en vez de contexto por tenant.
Riesgo: mezcla de datos entre iglesias, principal causa de perdida de confianza B2B.

2. Healthcheck inconsistente con estandar de operacion.
Evidencia:
- `/health` responde `{ ok: true }` en [server.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/server.js).
Riesgo: falta estandar para monitoreo externo si se espera `{"status":"ok"}`.

3. Flujo de auth sin refresh token robusto.
Evidencia:
- uso de JWT de sesion sin capa de refresh centralizada en [auth.js](/Users/Valentin/Desktop/church-system-alpha/backend/src/routes/auth.js).
Riesgo: sesiones fragiles, expiraciones abruptas y friccion en uso diario.

4. Inconsistencias de idioma/copy en vistas internas.
Evidencia:
- avance parcial en login/registro/menu/dashboard, pero resto de pantallas sin homologar.
Riesgo: percepcion de producto incompleto en demos y trials.

## 3) Bugs Menores

1. Configuracion de puertos con defaults repetidos y fallbacks ambiguos.
2. Scripts de migracion/seed mezclados con runtime y logs de consola.
3. Estructura frontend no alineada aun al target modular completo (`modules/theme/layouts` consolidado).

## 4) Deuda Tecnica Relevante

1. Backend con capa de datos acoplada a SQLite en memoria/export.
2. Falta de capa de repositorios/servicios por dominio para separar reglas de negocio.
3. Falta de estrategia unica de validacion de entrada por endpoint (schema centralizado).
4. Falta de suite de pruebas automatizadas minima de auth, tenant y rutas criticas.

## 5) Prioridades de Ejecucion (orden exacto recomendado)

1. Infraestructura de datos estable:
- migrar core a PostgreSQL (Neon) con Prisma.
- definir esquema inicial: `users`, `iglesias`, `personas`, `roles`.

2. Seguridad y control de acceso:
- eliminar defaults inseguros.
- endurecer middleware auth (JWT, expiracion, usuario activo, tenant).
- bloquear rutas privadas sin excepciones.

3. Multi-tenant obligatorio:
- inyectar `iglesiaId` en request autenticado.
- filtrar SIEMPRE por tenant en queries criticas.

4. Superficie operativa:
- CORS con whitelist estricta.
- logger estructurado (`pino`) reemplazando `console.log`.
- healthcheck estandar `{"status":"ok"}`.

5. Cierre de confianza comercial:
- checklist de QA manual de login/tenant/persistencia.
- limpieza de secretos en backups locales y politica de manejo seguro.

## 6) Estado de Avance de Semana 1 (contra plan)

- Dia 1 (auditoria): completado con hallazgos accionables.
- Dia 2+ (limpieza/estabilidad): pendiente, pero con backlog priorizado.

## 7) Criterio de Exito para pasar a Semana 2

1. Sin defaults de seguridad inseguros.
2. Core persistiendo en PostgreSQL.
3. Auth y tenant validados en rutas privadas.
4. CORS bloqueado por whitelist.
5. Logs estructurados.
6. Prueba manual de aislamiento entre 2 iglesias exitosa.
