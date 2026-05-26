/**
 * useNotificaciones — hook para Web Push notifications
 * - Pide permiso al usuario
 * - Se suscribe al backend via /notificaciones/subscribe
 * - Guarda el estado en localStorage
 */
import { useState, useEffect } from 'react'
import { apiFetch } from '../services/api.js'

export function useNotificaciones() {
  const [permiso, setPermiso]       = useState(Notification?.permission || 'default')
  const [suscrito, setSuscrito]     = useState(false)
  const [cargando, setCargando]     = useState(false)
  const [error, setError]           = useState(null)
  const [swReg, setSwReg]           = useState(null)

  // Verificar si ya está suscrito al montar
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    navigator.serviceWorker.ready.then(reg => {
      setSwReg(reg)
      reg.pushManager.getSubscription().then(sub => {
        setSuscrito(!!sub)
      })
    })
    setPermiso(Notification.permission)
  }, [])

  async function suscribir() {
    setError(null)
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Tu browser no soporta notificaciones push')
      return false
    }

    try {
      setCargando(true)

      // Pedir permiso
      const perm = await Notification.requestPermission()
      setPermiso(perm)
      if (perm !== 'granted') {
        setError('Permiso denegado')
        setCargando(false)
        return false
      }

      // Obtener la VAPID key del backend
      const { publicKey } = await apiFetch('/notificaciones/vapid-key')
      if (!publicKey) {
        setError('Notificaciones no configuradas en el servidor')
        setCargando(false)
        return false
      }

      // Suscribir al service worker
      const reg = swReg || await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      })

      // Guardar en el backend
      await apiFetch('/notificaciones/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription })
      })

      setSuscrito(true)
      setCargando(false)
      return true
    } catch (err) {
      setError(err.message)
      setCargando(false)
      return false
    }
  }

  async function desuscribir() {
    try {
      setCargando(true)
      const reg = swReg || await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await apiFetch('/notificaciones/unsubscribe', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: sub.endpoint })
        })
        await sub.unsubscribe()
      }
      setSuscrito(false)
    } catch (err) {
      setError(err.message)
    }
    setCargando(false)
  }

  async function testear() {
    try {
      const r = await apiFetch('/notificaciones/test', { method: 'POST' })
      return r
    } catch (err) {
      setError(err.message)
      return null
    }
  }

  const soportado = typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  return { permiso, suscrito, cargando, error, soportado, suscribir, desuscribir, testear }
}

// Utilitario: convertir base64url a Uint8Array para VAPID
function urlBase64ToUint8Array(base64String) {
  const padding   = '='.repeat((4 - base64String.length % 4) % 4)
  const base64    = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData   = window.atob(base64)
  const outputArr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArr[i] = rawData.charCodeAt(i)
  return outputArr
}
