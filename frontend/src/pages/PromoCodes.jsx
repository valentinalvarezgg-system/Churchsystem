import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import Modal from '../components/Modal.jsx'

export default function PromoCodes() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ code: '', dias_extra: 30 })
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
      setForm({ code: '', dias_extra: 30 })
      load()
    } catch (e) {
      toast.error(e.message || 'Error al crear')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout title="Códigos Promocionales" subtitle="Gestionar códigos de extensión de prueba">
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Crear código</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner-xs" style={{ width: 32, height: 32 }} />
        </div>
      ) : codes.length === 0 ? (
        <div className="empty-state">
          <span style={{ fontSize: 48 }}>🎟️</span>
          <p>No hay códigos creados</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Días extra</th>
                <th>Estado</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{c.code}</td>
                  <td>{c.dias_extra} días</td>
                  <td>
                    <span className={`badge ${c.usado ? 'badge-secondary' : 'badge-success'}`}>
                      {c.usado ? 'Usado' : 'Disponible'}
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
        title="Crear código promocional"
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
            min="1"
            max="365"
          />
        </div>
      </Modal>
    </Layout>
  )
}
