import db from '../lib/db.js'

export function registrar({ userId=null, email='', rol='', accion, entidad='', entidadId='', detalle='' }) {
  try {
    db.run('INSERT INTO auditoria (userId,email,rol,accion,entidad,entidadId,detalle) VALUES (?,?,?,?,?,?,?)',
      [userId, email, rol, accion, entidad, String(entidadId||''), detalle])
  } catch(e) { console.error('Auditoría error:', e.message) }
}
