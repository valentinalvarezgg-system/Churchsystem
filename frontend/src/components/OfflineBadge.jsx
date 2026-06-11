import { useSync } from '../hooks/useSync'

export function OfflineBadge() {
  const { online, syncing, pending, error, triggerSync } = useSync()

  if (online && !pending && !syncing) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'max(16px, env(safe-area-inset-bottom))',
      right: 16,
      zIndex: 9999,
      backgroundColor: online && !pending ? 'var(--c-success)' : 'var(--c-warning)',
      color: '#fff',
      padding: '12px 16px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 600,
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,.3)',
    }}>
      <span>{syncing ? 'Sincronizando...' : pending ? `${pending} cambios pendientes` : '✓ Sincronizado'}</span>
      {pending > 0 && (
        <button
          onClick={triggerSync}
          style={{
            background: 'rgba(255,255,255,.3)',
            border: 'none',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Sincronizar ahora
        </button>
      )}
      {error && <span title={error}>⚠️</span>}
    </div>
  )
}
