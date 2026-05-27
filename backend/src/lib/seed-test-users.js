import db from './db.js'
import bcrypt from 'bcryptjs'
const hash = (p) => bcrypt.hashSync(p, 10)
console.log('\n🌱 Creando perfiles de prueba...\n')

// Iglesias
try { db.run("INSERT OR IGNORE INTO iglesias (nombre,token,adminId,plan) VALUES ('Iglesia Central','IGL-TEST-ARG1',1,'GENERAL')") } catch(e){}
try { db.run("INSERT OR IGNORE INTO iglesias (nombre,token,adminId,plan) VALUES ('Iglesia Nueva Vida','IGL-TEST-ARG2',0,'GENERAL')") } catch(e){}

const USERS = [
  {email:'lider@iglesia.com',pw:'lider123',nombre:'Lucas',apellido:'Fernández',rol:'LIDER',plan:'LIDER'},
  {email:'culto@iglesia.com',pw:'culto123',nombre:'María',apellido:'González',rol:'PASTOR_CULTO',plan:'CULTO'},
  {email:'consolidacion@iglesia.com',pw:'consol123',nombre:'Andrés',apellido:'Romero',rol:'CONSOLIDACION',plan:'CONSOLIDACION'},
  {email:'admin2@iglesia.com',pw:'admin2123',nombre:'Valeria',apellido:'Torres',rol:'STAFF',plan:'ADMINISTRACION'},
  {email:'general@iglesia.com',pw:'general123',nombre:'Roberto',apellido:'Sánchez',rol:'PASTOR_GENERAL',plan:'GENERAL'},
  {email:'pastor2@iglesia.com',pw:'pastor2123',nombre:'Pastor Carlos',apellido:'Méndez',rol:'PASTOR_GENERAL',plan:'GENERAL'},
]

for (const u of USERS) {
  try {
    const exists = db.get('SELECT id FROM users WHERE email=?',[u.email])
    if (exists) {
      db.run('UPDATE users SET nombre=?,apellido=?,password=?,rol=?,plan=?,activo=1,emailVerificado=1 WHERE id=?',
        [u.nombre,u.apellido,hash(u.pw),u.rol,u.plan,exists.id])
    } else {
      db.run('INSERT INTO users (nombre,apellido,email,password,rol,plan,activo,emailVerificado) VALUES (?,?,?,?,?,?,1,1)',
        [u.nombre,u.apellido,u.email,hash(u.pw),u.rol,u.plan])
    }
    console.log(`  ✓ ${u.plan.padEnd(16)} ${u.email.padEnd(32)} ${u.pw}`)
  } catch(e) { console.error(`  ✗ ${u.email}:`, e.message) }
}

// Update admin original
try { db.run("UPDATE users SET plan='GENERAL', emailVerificado=1 WHERE email='admin@iglesia.com'") } catch(e){}

// Assign pastor2 to iglesia 2
try {
  const p2 = db.get("SELECT id FROM users WHERE email='pastor2@iglesia.com'")
  const ig2 = db.get("SELECT id FROM iglesias WHERE token='IGL-TEST-ARG2'")
  if (p2 && ig2) { db.run('UPDATE iglesias SET adminId=? WHERE id=?',[p2.id,ig2.id]); db.run('UPDATE users SET iglesiaId=? WHERE id=?',[ig2.id,p2.id]) }
} catch(e) {}

// Assign others to iglesia 1
try {
  const ig1 = db.get("SELECT id FROM iglesias WHERE token='IGL-TEST-ARG1'")
  if (ig1) db.run("UPDATE users SET iglesiaId=? WHERE email IN ('admin@iglesia.com','lider@iglesia.com','culto@iglesia.com','consolidacion@iglesia.com','admin2@iglesia.com','general@iglesia.com')",[ig1.id])
} catch(e){}

console.log('\n  Tokens: IGL-TEST-ARG1 (Central) | IGL-TEST-ARG2 (Nueva Vida)\n✅ Seed completado\n')
