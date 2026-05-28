import { useState, useEffect } from 'react'
import Icons from '../components/Icons.jsx'
import Layout from '../components/Layout.jsx'
import { apiFetch, getStoredContext } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import Modal from '../components/Modal.jsx'

export default function PromoCodes() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ code: '', dias_extra: 0, descuento_porcentaje: 15, duracion_meses: 3, max_usos: 1 })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/promo-codes')
      setCodes(data)
    } catch (e) {
      toast.error('Error al cargar códigos')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.code.trim()) { toast.warning('Ingresá un código'); return }
    setSaving(true)
    try {
      await apiFetch('/promo-codes', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      toast.success('Código creado')
      setModal(false)
      setForm({ code: '', dias_extra: 0, descuento_porcentaje: 15, duracion_meses: 3, max_usos: 1 })
      load()
    } catch (e) {
      toast.error(e.message || 'Error al crear')
    } finally {
      setSaving(false)
    }
  }

  function inviteLink(code) {
    const ctx = getStoredContext()
    const qp = new URLSearchParams({ promo: code })
    if (ctx.country) qp.set('country', ctx.country)
    if (ctx.currency) qp.set('currency', ctx.currency)
    if (ctx.lang) qp.set('lang', ctx.lang)
    return `${window.location.origin}/app/registro?${qp.toString()}`
  }

  return (
    <Layout title="Invitaciones y descuentos" subtitle="Enlaces con 15% OFF por 3 meses">
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Crear código</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner-xs" style={{ width: 32, height: 32 }} />
        </div>
      ) : codes.length === 0 ? (
        <div className="empty-state">
          <span style={{ fontSize: 48 }}><Icons.Ticket /></span>
          <p>No hay códigos creados</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Beneficio</th>
                <th>Usos</th>
                <th>Enlace</th>
                <th>Estado</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{c.code}</td>
                  <td>
                    {Number(c.descuento_porcentaje || 0) > 0
                      ? `${c.descuento_porcentaje}% OFF por ${c.duracion_meses || 0} meses`
                      : `${c.dias_extra} dias extra`}
                  </td>
                  <td>{c.usos || 0}/{Number(c.max_usos || 0) === 0 ? 'Ilimitado' : c.max_usos}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => {
                        navigator.clipboard?.writeText(inviteLink(c.code))
                        toast.success('Enlace copiado')
                      }}
                    >
                      Copiar enlace
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${!c.disponible ? 'badge-secondary' : 'badge-success'}`}>
                      {c.disponible ? 'Disponible' : 'Usado'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {new Date(c.createdAt).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Crear invitación con descuento"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModal(false)} disabled={saving}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creando...' : 'Crear'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label htmlFor="code">Código</label>
          <input
            type="text"
            id="code"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="PROMO2026"
            style={{ textTransform: 'uppercase' }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="dias">Días extra de prueba</label>
          <input
            type="number"
            id="dias"
            value={form.dias_extra}
            onChange={e => setForm(f => ({ ...f, dias_extra: parseInt(e.target.value) || 0 }))}
            min="0"
            max="365"
          />
        </div>
        <div className="form-group">
          <label htmlFor="descuento">Descuento (%)</label>
          <input
            type="number"
            id="descuento"
            value={form.descuento_porcentaje}
            onChange={e => setForm(f => ({ ...f, descuento_porcentaje: parseInt(e.target.value) || 0 }))}
            min="0"
            max="100"
          />
        </div>
        <div className="form-group">
          <label htmlFor="meses">Duración del descuento (meses)</label>
          <input
            type="number"
            id="meses"
            value={form.duracion_meses}
            onChange={e => setForm(f => ({ ...f, duracion_meses: parseInt(e.target.value) || 0 }))}
            min="1"
            max="24"
          />
        </div>
        <div className="form-group">
          <label htmlFor="usos">Usos máximos</label>
          <input
            type="number"
            id="usos"
            value={form.max_usos}
            onChange={e => setForm(f => ({ ...f, max_usos: Math.max(0, parseInt(e.target.value) || 0) }))}
            min="0"
            max="1000"
          />
          <small style={{ color: 'var(--text-muted)' }}>Usá 0 para enlaces ilimitados.</small>
        </div>
      </Modal>
    </Layout>
  )
}
