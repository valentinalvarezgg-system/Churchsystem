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

  const iconSpan = document.createElement('span')
  iconSpan.className = 'toast-icon'
  iconSpan.textContent = icons[type] || 'ℹ'

  const body = document.createElement('div')
  body.className = 'toast-body'

  const titleDiv = document.createElement('div')
  titleDiv.className = 'toast-title'
  titleDiv.textContent = title
  body.appendChild(titleDiv)

  if (message) {
    const msgDiv = document.createElement('div')
    msgDiv.className = 'toast-msg'
    msgDiv.textContent = message
    body.appendChild(msgDiv)
  }

  const closeBtn = document.createElement('button')
  closeBtn.className = 'toast-close'
  closeBtn.setAttribute('aria-label', 'Cerrar')
  closeBtn.textContent = '×'

  const progress = document.createElement('div')
  progress.className = 'toast-progress'
  progress.style.animationDuration = `${duration}ms`

  el.appendChild(iconSpan)
  el.appendChild(body)
  el.appendChild(closeBtn)
  el.appendChild(progress)

  const remove = () => {
    el.classList.add('removing')
    setTimeout(() => el.remove(), 220)
  }

  closeBtn.addEventListener('click', remove)
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
