import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertLaunchEnvironment } from '../src/lib/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'src')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(js|mjs|ts)$/.test(entry.name)) out.push(full)
  }
  return out
}

function rel(file) {
  return path.relative(root, file)
}

function hasRequireAuth(args = '') {
  return /\brequireAuth\b/.test(args)
}

const files = walk(src)
const routeFiles = files.filter(file => file.includes(`${path.sep}routes${path.sep}`))
const legacyDbImports = files.filter(file => /from ['"].*\/lib\/db\.js['"]/.test(fs.readFileSync(file, 'utf8')) || /from ['"]\.\.?\/lib\/db\.js['"]/.test(fs.readFileSync(file, 'utf8')))
const routerFindings = []

for (const file of routeFiles) {
  const text = fs.readFileSync(file, 'utf8')
  const routeRegex = /router\.(get|post|put|delete|patch)\s*\(([\s\S]*?)\n\)/g
  let match
  while ((match = routeRegex.exec(text))) {
    const snippet = match[0].replace(/\s+/g, ' ').slice(0, 240)
    const publicAllowed = /\/login|\/refresh|\/logout|\/google|\/apple|\/callback|\/registro|\/crear|\/verificar|\/planes|\/catalogo|\/webhook|\/enviar|\/reenviar/.test(snippet)
    if (!hasRequireAuth(snippet) && !publicAllowed) {
      routerFindings.push(`${rel(file)} :: ${snippet}`)
    }
  }
}

const env = assertLaunchEnvironment()
const critical = []
const warnings = [...env.warnings]

if (!env.ok) critical.push(...env.errors)
if (pkg.dependencies?.['sql.js']) critical.push('package.json todavia incluye sql.js.')
if (legacyDbImports.length) critical.push(`${legacyDbImports.length} archivos siguen importando lib/db.js legacy.`)
if (routerFindings.length) warnings.push(`${routerFindings.length} rutas parecen no pasar por requireAuth o whitelist publica.`)

const report = {
  ok: critical.length === 0,
  critical,
  warnings,
  legacyDbImports: legacyDbImports.map(rel).sort(),
  unprotectedRouteCandidates: routerFindings.sort(),
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
