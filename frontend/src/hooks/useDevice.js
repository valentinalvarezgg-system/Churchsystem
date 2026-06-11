/**
 * useDevice — detección de dispositivo con 3 capas: desktop / tablet / phone.
 *
 * Aplica data-device y data-orient en <html> para que el CSS pueda usar
 * selectores de alta especificidad como [data-device="phone"] .main { ... }.
 *
 * Breakpoints estándar:
 *   phone:   < 768px  (o landscape con height < 550px — cubre iPhone grande)
 *   tablet:  768–1023px
 *   desktop: ≥ 1024px
 *
 * Fixes vs useOrientation.js anterior:
 *   - Memory leak: orientationchange listener nunca era removido (función anónima ≠ referencia guardada)
 *   - iPhone en landscape (ej. 932px) se clasificaba como tablet — ahora es phone
 *   - Sin data attrs en HTML → CSS no podía diferenciar dispositivos en JS
 *   - Sin debounce en resize → renders innecesarios
 */
import { useState, useEffect } from 'react'

const DESKTOP = 1024
const TABLET  = 768
const PHONE_LANDSCAPE_MAX_H = 550  // iPhones en landscape tienen h ≤ ~430px

function snapshot() {
  if (typeof window === 'undefined') {
    return makeState('desktop', 'portrait', 1280, 800)
  }
  const w = window.innerWidth
  const h = window.innerHeight
  const isPortrait = h >= w

  let device
  if (w >= DESKTOP) {
    device = 'desktop'
  } else if (w >= TABLET) {
    // Un iPhone 14 Pro Max en landscape tiene width=932px pero height=430px.
    // Un iPad en landscape tiene height > 600px siempre.
    // Usamos height para distinguirlos.
    device = (!isPortrait && h < PHONE_LANDSCAPE_MAX_H) ? 'phone' : 'tablet'
  } else {
    device = 'phone'
  }

  return makeState(device, isPortrait ? 'portrait' : 'landscape', w, h)
}

function makeState(device, orient, w, h) {
  const isDesktop  = device === 'desktop'
  const isTablet   = device === 'tablet'
  const isPhone    = device === 'phone'
  const isPortrait = orient === 'portrait'
  return {
    device, orient, w, h,
    isDesktop, isTablet, isPhone,
    isPortrait,
    isLandscape: !isPortrait,
    // Helpers de columnas para layouts JS
    cols2:     isDesktop ? 2 : 1,
    cols3:     isDesktop ? 3 : (isTablet || !isPortrait) ? 2 : 1,
    cols4:     isDesktop ? 4 : (isTablet || !isPortrait) ? 2 : 1,
    colsStats: isDesktop ? 6 : (isTablet || !isPortrait) ? 4 : 3,
  }
}

function applyAttrs({ device, orient }) {
  const el = document.documentElement
  if (el.dataset.device !== device) el.dataset.device = device
  if (el.dataset.orient !== orient) el.dataset.orient = orient
}

// Inicialización sincrónica al importar el módulo:
// los atributos quedan disponibles antes del primer render de React.
if (typeof document !== 'undefined') {
  applyAttrs(snapshot())
}

export function useDevice() {
  const [state, setState] = useState(snapshot)

  useEffect(() => {
    applyAttrs(state) // garantizar estado inicial en el efecto

    let raf
    function update() {
      const next = snapshot()
      applyAttrs(next)
      setState(prev =>
        prev.device === next.device && prev.orient === next.orient ? prev : next
      )
    }

    // rAF para evitar renders innecesarios en cada pixel de resize
    function onResize() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }

    // orientationchange termina antes de que innerWidth se actualice; esperamos 200ms
    let orientTimer
    function onOrient() {
      clearTimeout(orientTimer)
      orientTimer = setTimeout(update, 200)
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrient)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrient)
      cancelAnimationFrame(raf)
      clearTimeout(orientTimer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}

// Alias de compatibilidad para componentes que todavía importan useOrientation
export { useDevice as useOrientation }
