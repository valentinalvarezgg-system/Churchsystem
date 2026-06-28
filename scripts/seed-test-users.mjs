#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const requireFromBackend = createRequire(new URL('../backend/package.json', import.meta.url))
const bcrypt = requireFromBackend('bcryptjs')

const ROLE_USERS = [
  ['qa.pastor.general@churchsystem.test', 'PASTOR_GENERAL', 'MAX', 'Pastor General QA'],
  ['qa.pastor.culto@churchsystem.test', 'PASTOR_CULTO', 'MAX', 'Pastor Culto QA'],
  ['qa.consolidacion@churchsystem.test', 'CONSOLIDACION', 'MAX', 'Consolidación QA'],
  ['qa.staff@churchsystem.test', 'STAFF', 'MAX', 'Staff QA'],
  ['qa.lider@churchsystem.test', 'LIDER', 'MAX', 'Líder QA'],
]

const PLAN_USERS = [
  ['qa.plan.free@churchsystem.test', 'FREE', 'Plan Free QA'],
  ['qa.plan.pro@churchsystem.test', 'PRO', 'Plan Pro QA'],
  ['qa.plan.max@churchsystem.test', 'MAX', 'Plan Max QA'],
  ['qa.plan.church100@churchsystem.test', 'CHURCH_100', 'Plan Church 100 QA'],
  ['qa.plan.church500@churchsystem.test', 'CHURCH_500', 'Plan Church 500 QA'],
  ['qa.plan.church1000@churchsystem.test', 'CHURCH_1000', 'Plan Church 1000 QA'],
]

function parseArgs(argv) {
  const clean = argv.filter(arg => arg !== '--')
  const valueAfter = name => {
    const i = clean.indexOf(name)
    return i >= 0 ? clean[i + 1] : ''
  }
  return {
    password: valueAfter('--password') || process.env.QA_TEST_PASSWORD || `ChurchQA-${crypto.randomBytes(8).toString('base64url')}`,
  }
}

function loadEnvFile(path = 'backend/.env') {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

async function ensureRole(pgOne, codigo) {
  const role = await pgOne(
    `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
     VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
     RETURNING id`,
    [codigo, codigo.replace(/_/g, ' ')]
  )
  return role.id
}

async function ensureChurch(pgOne, pgExec, nombre, token) {
  await pgExec(`ALTER TABLE "Iglesia" ADD COLUMN IF NOT EXISTS trial_hasta TIMESTAMPTZ`).catch(() => {})
  const church = await pgOne(
    `INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt", trial_hasta)
     VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NOW() + INTERVAL '30 days')
     ON CONFLICT ("token") DO UPDATE SET "nombre"=EXCLUDED."nombre","updatedAt"=CURRENT_TIMESTAMP
     RETURNING id, nombre, token`,
    [nombre, token]
  )
  for (const [clave, valor] of [
    ['nombre_iglesia', nombre],
    ['setup_completado', '1'],
    ['trial_inicio', new Date().toISOString().slice(0, 10)],
    ['trial_fin', new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)],
  ]) {
    await pgExec(
      `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
       VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
      [church.id, clave, valor]
    )
  }
  return church
}

async function upsertUser({ pgOne, email, nombre, rol, plan, iglesiaId, roleId, passwordHash, superadmin = false }) {
  await pgOne(
    `INSERT INTO "User"
      ("email","password","nombre","apellido","activo","emailVerificado","iglesiaId","rolId",
       "createdAt","updatedAt","rol","plan","pais","divisa","idioma","es_superadmin")
     VALUES
      ($1,$2,$3,'QA',true,true,$4,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$6,$7,'AR','ARS','es',$8)
     ON CONFLICT ("email") DO UPDATE SET
       "password"=EXCLUDED."password",
       "nombre"=EXCLUDED."nombre",
       "activo"=true,
       "emailVerificado"=true,
       "iglesiaId"=EXCLUDED."iglesiaId",
       "rolId"=EXCLUDED."rolId",
       "rol"=EXCLUDED."rol",
       "plan"=EXCLUDED."plan",
       "pais"='AR',
       "divisa"='ARS',
       "idioma"='es',
       "es_superadmin"=EXCLUDED."es_superadmin",
       "deletedAt"=NULL,
       "updatedAt"=CURRENT_TIMESTAMP
     RETURNING id, email, rol, plan, "iglesiaId", "es_superadmin"`,
    [email, passwordHash, nombre, iglesiaId, roleId, rol, plan, superadmin]
  )
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  loadEnvFile()
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no configurado')

  const { pgOne, pgExec } = await import('../backend/src/lib/pg.js')
  await pgExec(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "es_superadmin" BOOLEAN NOT NULL DEFAULT false`)

  const passwordHash = await bcrypt.hash(opts.password, 10)
  const godRoleId = await ensureRole(pgOne, 'GODMODE')
  const rootChurch = await ensureChurch(pgOne, pgExec, 'GodMode QA', 'GODMODE-QA')
  await upsertUser({
    pgOne,
    email: 'qa.godmode@churchsystem.test',
    nombre: 'GodMode QA',
    rol: 'GODMODE',
    plan: 'GODMODE',
    iglesiaId: rootChurch.id,
    roleId: godRoleId,
    passwordHash,
    superadmin: true,
  })

  const roleChurch = await ensureChurch(pgOne, pgExec, 'QA Roles Church', 'QA-ROLES-CHURCH')
  for (const [email, rol, plan, nombre] of ROLE_USERS) {
    const roleId = await ensureRole(pgOne, rol)
    await upsertUser({ pgOne, email, nombre, rol, plan, iglesiaId: roleChurch.id, roleId, passwordHash })
  }

  for (const [email, plan, nombre] of PLAN_USERS) {
    const church = await ensureChurch(pgOne, pgExec, nombre.replace('Plan ', 'QA '), `QA-${plan}`)
    const roleId = await ensureRole(pgOne, 'PASTOR_GENERAL')
    await upsertUser({ pgOne, email, nombre, rol: 'PASTOR_GENERAL', plan, iglesiaId: church.id, roleId, passwordHash })
  }

  console.log('Cuentas QA listas')
  console.log(`Password temporal: ${opts.password}`)
  console.log('GodMode: qa.godmode@churchsystem.test')
  console.log('Roles:')
  for (const [email, rol] of ROLE_USERS) console.log(`  ${rol}: ${email}`)
  console.log('Planes:')
  for (const [email, plan] of PLAN_USERS) console.log(`  ${plan}: ${email}`)
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`)
  process.exit(1)
})
