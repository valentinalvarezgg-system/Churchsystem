/**
 * useOrientation — detecta portrait/landscape y tamaño de pantalla en tiempo real.
 * Se actualiza automáticamente al rotar o cambiar el tamaño de la ventana.
 */
import { useState, useEffect } from 'react'

export function useOrientation() {
  const get = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const portrait   = h >= w
    const landscape  = !portrait
    const isPhone    = Math.min(w, h) < 500
    const isTablet   = Math.min(w, h) >= 500 && Math.max(w, h) < 1024
    const isDesktop  = w >= 1024

    return {
      portrait,
      landscape,
      isPhone,
      isTablet,
      isDesktop,
      w, h,
      // Cuántas columnas usar según contexto
      cols2: isDesktop ? 2 : 1,
      cols3: isDesktop ? 3 : (isTablet || (isPhone && landscape)) ? 2 : 1,
      cols4: isDesktop ? 4 : (isTablet || (isPhone && landscape)) ? 2 : 1,
      colsStats: isDesktop ? 6 : (isTablet || (isPhone && landscape)) ? 4 : 3,
    }
  }

  const [ori, setOri] = useState(get)

  useEffect(() => {
    const update = () => setOri(get())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', () => setTimeout(update, 200))
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return ori
}
