import { useEffect, useState, useCallback } from 'react'

export function useSync() {
  const [status, setStatus] = useState({ online: navigator.onLine, syncing: false, pending: 0 })
  const [error, setError] = useState(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
        console.warn('SW registration failed', err)
      })
    }

    const handleOnline = () => {
      setStatus(prev => ({ ...prev, online: true }))
      triggerSync()
    }
    const handleOffline = () => {
      setStatus(prev => ({ ...prev, online: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const handleMessage = (event) => {
      const { data } = event
      if (!data.type) return

      switch (data.type) {
        case 'sync-start':
          setStatus(prev => ({ ...prev, syncing: true }))
          setError(null)
          break
        case 'sync-complete':
          setStatus(prev => ({ ...prev, syncing: false, pending: 0 }))
          setError(null)
          break
        case 'synced':
          setStatus(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }))
          break
        case 'queue-added':
          setStatus(prev => ({ ...prev, pending: prev.pending + (data.count || 1) }))
          break
        case 'sync-error':
          setError(data.error || `Error sincronizando ID ${data.id}`)
          break
        default:
          break
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage)
      }
    }
  }, [])

  const triggerSync = useCallback(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'sync-now' })
    }
  }, [])

  return { ...status, triggerSync, error }
}
