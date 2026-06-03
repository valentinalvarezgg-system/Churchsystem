export const TEMPLATES = {
  REUNION_RECORDATORIO: 'reunion_recordatorio',
  BIENVENIDA_VISITANTE: 'bienvenida_visitante',
  ORACION_SEGUIMIENTO: 'oracion_seguimiento',
  CUMPLEANOS: 'cumpleanos_miembro',
  FACTURA_CHURCHSYSTEM: 'churchsystem_factura',
}

export function reunionRecordatorioComponents({ nombre, titulo, fecha, hora, lugar }) {
  return {
    body: [
      nombre,
      titulo,
      fecha,
      hora,
      lugar,
    ].filter(value => value != null && String(value).trim() !== ''),
  }
}
