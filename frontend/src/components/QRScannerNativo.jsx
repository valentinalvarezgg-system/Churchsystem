import { useState } from 'react'
import { toast } from './Toast.jsx'
import { useNavigate } from 'react-router-dom'

const isNative = typeof window !== 'undefined' &&
  typeof window.Capacitor !== 'undefined' &&
  Boolean(window.Capacitor?.isNativePlatform?.())

export default function QRScannerNativo({ style }) {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)

  if (!isNative) return null

  async function scan() {
    setScanning(true)
    try {
      const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning')

      const perm = await BarcodeScanner.requestPermissions()
      if (perm.camera !== 'granted' && perm.camera !== 'limited') {
        toast.error('Permiso de cámara denegado. Habilitalo en Configuración > Privacidad.')
        setScanning(false)
        return
      }

      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] })
      const raw = barcodes[0]?.rawValue
      if (!raw) { setScanning(false); return }

      // Si el QR es una URL de check-in de esta app, navegar internamente
      try {
        const url = new URL(raw)
        const checkinMatch = url.pathname.match(/\/checkin\/(\w+)\/(\w+)/)
        if (checkinMatch) {
          navigate(`/checkin/${checkinMatch[1]}/${checkinMatch[2]}`)
          setScanning(false)
          return
        }
        // URL externa — abrir en el navegador del sistema
        window.open(raw, '_system')
      } catch {
        toast.info(`QR: ${raw}`)
      }
    } catch (err) {
      toast.error('Error al escanear: ' + (err?.message || 'Intentá de nuevo'))
    }
    setScanning(false)
  }

  return (
    <button
      className="btn btn-primary"
      onClick={scan}
      disabled={scanning}
      style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}
    >
      {scanning
        ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span> Escaneando…</>
        : <>📷 Escanear QR de check-in</>
      }
    </button>
  )
}
