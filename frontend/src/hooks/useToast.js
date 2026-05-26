/**
 * useToast — Sistema global de notificaciones tipo Toast
 *
 * Uso:
 *   const toast = useToast()
 *   toast.success('Guardado')
 *   toast.error('Error al guardar')
 *   toast.warning('Atención')
 *   toast.info('Información')
 */
import { useCallback } from 'react'

let toastId = 0

function createToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container')
  if (!container) return

  const id = ++toastId
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }

  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.id = `toast-${id}`
  el.style.position = 'relative'
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Cerrar">×</button>
    <div class="toast-progress" style="animation-duration:${duration}ms"></div>
  `

  const remove = () => {
    el.classList.add('removing')
    setTimeout(() => el.remove(), 220)
  }

  el.querySelector('.toast-close').addEventListener('click', remove)
  const timer = setTimeout(remove, duration)
  el.addEventListener('mouseenter', () => clearTimeout(timer))
  el.addEventListener('mouseleave', () => setTimeout(remove, 1500))

  container.appendChild(el)
}

export function useToast() {
  return {
    success: useCallback((title, msg) => createToast('success', title, msg), []),
    error:   useCallback((title, msg) => createToast('error',   title, msg), []),
    warning: useCallback((title, msg) => createToast('warning', title, msg), []),
    info:    useCallback((title, msg) => createToast('info',    title, msg), []),
  }
}

// Exportar función standalone para usar fuera de componentes React
export const toast = {
  success: (title, msg) => createToast('success', title, msg),
  error:   (title, msg) => createToast('error',   title, msg),
  warning: (title, msg) => createToast('warning', title, msg),
  info:    (title, msg) => createToast('info',    title, msg),
}
