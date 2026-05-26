/**
 * CamaraFoto — Componente para capturar foto con la cámara del dispositivo
 * Se usa en el Perfil de persona para sacar la foto de referencia facial
 */
import { useRef, useState, useEffect, useCallback } from 'react'

export default function CamaraFoto({ onFoto, onCerrar, nombre = '' }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const [fase, setFase]           = useState('camara')  // camara | preview | subiendo | ok | error
  const [capturedUrl, setCapturedUrl] = useState(null)
  const [errMsg, setErrMsg]       = useState('')
  const [countdown, setCountdown] = useState(null)
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [facingMode, setFacingMode] = useState('user') // user | environment

  const iniciarCamara = useCallback(async (mode = facingMode) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
          setCamaraActiva(true)
        }
      }
    } catch (e) {
      setErrMsg(e.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Habilitá la cámara en el navegador.'
        : 'No se pudo acceder a la cámara: ' + e.message)
      setFase('error')
    }
  }, [facingMode])

  useEffect(() => {
    iniciarCamara()
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  function capturar() {
    // Cuenta regresiva 3..2..1
    setCountdown(3)
    let c = 3
    const iv = setInterval(() => {
      c--
      setCountdown(c)
      if (c === 0) {
        clearInterval(iv)
        setCountdown(null)
        sacarFoto()
      }
    }, 1000)
  }

  function sacarFoto() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const SIZE = 400
    canvas.width  = SIZE
    canvas.height = SIZE

    const ctx = canvas.getContext('2d')
    // Recorte cuadrado centrado
    const vw = video.videoWidth, vh = video.videoHeight
    const side = Math.min(vw, vh)
    const sx = (vw - side) / 2, sy = (vh - side) / 2

    ctx.save()
    // Si es cámara frontal, espejear
    if (facingMode === 'user') {
      ctx.translate(SIZE, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, sx, sy, side, side, 0, 0, SIZE, SIZE)
    ctx.restore()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedUrl(dataUrl)
    setFase('preview')
    streamRef.current?.getTracks().forEach(t => t.stop())
    setCamaraActiva(false)
  }

  function repetir() {
    setCapturedUrl(null)
    setFase('camara')
    iniciarCamara()
  }

  async function confirmar() {
    setFase('subiendo')
    try {
      await onFoto(capturedUrl)
      setFase('ok')
    } catch (e) {
      setErrMsg(e.message)
      setFase('error')
    }
  }

  function cambiarCamara() {
    const nuevo = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(nuevo)
    iniciarCamara(nuevo)
  }

  // Estilos
  const overlay = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  }
  const card = {
    background: '#0A0E1A',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20, overflow: 'hidden',
    width: '100%', maxWidth: 420,
    boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
  }
  const header = {
    padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div style={card}>
        <div style={header}>
          <div>
            <div style={{ color: 'var(--surface)', fontWeight: 700, fontSize: 15 }}>📷 Foto de referencia</div>
            {nombre && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{nombre}</div>}
          </div>
          <button onClick={onCerrar}
            style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.6)', padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
            ✕ Cerrar
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          {/* FASE CÁMARA */}
          {fase === 'camara' && (
            <>
              <div style={{ position: 'relative', background: '#000', aspectRatio: '1' }}>
                <video ref={videoRef} muted playsInline
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover',
                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                    display: 'block' }}
                />
                {/* Guía de encuadre */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    width: '65%', aspectRatio: '1', borderRadius: '50%',
                    border: '2px dashed rgba(255,255,255,0.35)',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                  }} />
                </div>
                {/* Countdown */}
                {countdown !== null && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 96, fontWeight: 900,
                    color: countdown === 1 ? '#EF4444' : countdown === 2 ? '#F59E0B' : '#3B82F6',
                    textShadow: '0 4px 24px rgba(0,0,0,0.8)',
                    animation: 'pulse 0.9s ease',
                  }}>
                    {countdown}
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', gap: 10 }}>
                <button onClick={capturar} disabled={!camaraActiva || countdown !== null}
                  style={{
                    flex: 1, padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
                    color: 'var(--surface)', fontSize: 15, fontWeight: 700,
                    opacity: !camaraActiva || countdown !== null ? 0.5 : 1,
                  }}>
                  {countdown !== null ? `Preparate... ${countdown}` : '📸 Capturar'}
                </button>
                <button onClick={cambiarCamara} data-tip="Cambiar cámara"
                  style={{ padding: '13px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 18 }}>
                  🔄
                </button>
              </div>
              <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '0 20px 16px', lineHeight: 1.5 }}>
                Mirá directo a la cámara. La foto se usa para el reconocimiento facial en el check-in.
              </p>
            </>
          )}

          {/* FASE PREVIEW */}
          {fase === 'preview' && capturedUrl && (
            <>
              <div style={{ background: '#000', aspectRatio: '1', position: 'relative' }}>
                <img src={capturedUrl} alt="Preview" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                <div style={{
                  position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: '6px 16px',
                  color: 'rgba(255,255,255,0.7)', fontSize: 12,
                }}>
                  Vista previa
                </div>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', gap: 10 }}>
                <button onClick={repetir}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  ↺ Repetir
                </button>
                <button onClick={confirmar}
                  style={{ flex: 2, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#16A34A,#15803D)', border: 'none', color: 'var(--surface)', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                  ✅ Usar esta foto
                </button>
              </div>
              <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '0 20px 16px' }}>
                ¿Se ve bien la cara? Si no, repetí.
              </p>
            </>
          )}

          {/* FASE SUBIENDO */}
          {fase === 'subiendo' && (
            <div style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ fontSize: 48, animation: 'spin 1s linear infinite' }}>⏳</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Guardando foto...</div>
            </div>
          )}

          {/* FASE OK */}
          {fase === 'ok' && (
            <div style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ fontSize: 72 }}>✅</div>
              <div style={{ color: 'var(--surface)', fontSize: 16, fontWeight: 700 }}>¡Foto guardada!</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Se usará para reconocimiento facial</div>
              <button onClick={onCerrar}
                style={{ marginTop: 8, padding: '10px 28px', borderRadius: 10, background: 'var(--primary)', border: 'none', color: 'var(--surface)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Cerrar
              </button>
            </div>
          )}

          {/* FASE ERROR */}
          {fase === 'error' && (
            <div style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
              <div style={{ fontSize: 48 }}>⚠️</div>
              <div style={{ color: '#FCA5A5', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>{errMsg}</div>
              <button onClick={() => { setFase('camara'); setErrMsg(''); iniciarCamara() }}
                style={{ padding: '10px 24px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--surface)', cursor: 'pointer', fontSize: 14 }}>
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Canvas oculto para captura */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <style>{`
        @keyframes pulse { 0%{transform:scale(0.8)}50%{transform:scale(1.1)}100%{transform:scale(1)} }
        @keyframes spin  { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
