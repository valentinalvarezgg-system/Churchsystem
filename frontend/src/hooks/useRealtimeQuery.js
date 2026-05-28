import { useCallback, useEffect, useState } from 'react'

export function useRealtimeQuery(key, loader, deps = [], options = {}) {
  const { intervalMs = 15000, enabled = true } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const result = await loader()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [enabled, ...deps])

  useEffect(() => {
    load()
    if (!enabled) return undefined

    const onChange = () => load()

    window.addEventListener('church:data-changed', onChange)
    const timer = intervalMs ? window.setInterval(load, intervalMs) : null

    return () => {
      window.removeEventListener('church:data-changed', onChange)
      if (timer) window.clearInterval(timer)
    }
  }, [load, enabled, intervalMs, key])

  return { data, setData, loading, error, refetch: load }
}
