import { useCallback, useEffect, useRef, useState } from 'react'

export function useRealtimeQuery(key, loader, deps = [], options = {}) {
  const { intervalMs = 15000, enabled = true } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const inFlightRef = useRef(null)
  const rerunRequestedRef = useRef(false)
  const mountedRef = useRef(true)
  const hasLoadedRef = useRef(false)

  const load = useCallback(async () => {
    if (!enabled) return null

    if (inFlightRef.current) {
      rerunRequestedRef.current = true
      return inFlightRef.current
    }

    if (!hasLoadedRef.current) setLoading(true)

    const run = (async () => {
      try {
        const result = await loader()
        if (!mountedRef.current) return result
        setData(result)
        setError(null)
        hasLoadedRef.current = true
        return result
      } catch (err) {
        if (mountedRef.current) setError(err)
        throw err
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    })()

    inFlightRef.current = run
    try {
      return await run
    } finally {
      inFlightRef.current = null
      if (rerunRequestedRef.current && mountedRef.current && enabled) {
        rerunRequestedRef.current = false
        void load()
      }
    }
  }, [enabled, ...deps])

  useEffect(() => {
    mountedRef.current = true
    load()
    if (!enabled) return undefined

    const onChange = () => load()

    window.addEventListener('church:data-changed', onChange)
    const timer = intervalMs ? window.setInterval(load, intervalMs) : null

    return () => {
      mountedRef.current = false
      window.removeEventListener('church:data-changed', onChange)
      if (timer) window.clearInterval(timer)
    }
  }, [load, enabled, intervalMs, key])

  return { data, setData, loading, error, refetch: load }
}
