import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, getApiUrl, getStoredContext, syncContextFromUser } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import { authCopy } from '../utils/i18n-auth.js'
import { APP_VERSION_LABEL } from '../version.js'
import BrandLogo from '../components/BrandLogo.jsx'

const S = {
  bg: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'#0A0E1A', padding:'20px', position:'relative', overflow:'hidden',
    fontFamily:"'Inter', 'Sora', sans-serif" },
  orb1: { position:'fixed', width:500, height:500, borderRadius:'50%',
    background:'#6B5CFF', filter:'blur(120px)', opacity:.1,
    top:-150, right:-100, pointerEvents:'none' },
  orb2: { position:'fixed', width:350, height:350, borderRadius:'50%',
    background:'#06B6D4', filter:'blur(120px)', opacity:.08,
    bottom:'10%', left:-80, pointerEvents:'none' },
  card: { position:'relative', width:'100%', maxWidth:420,
    background:'rgba(30,41,59,0.85)', backdropFilter:'blur(24px)',
    borderRadius:24, padding:'44px 40px',
    border:'1px solid rgba(255,255,255,0.09)',
    boxShadow:'0 30px 60px -12px rgba(0,0,0,0.6)' },
  logoWrap: { textAlign:'center', marginBottom:32 },
  h1: { fontSize:26, fontWeight:800, color:'#F1F5F9', margin:'0 0 4px',
    fontFamily:"'Sora', sans-serif" },
  sub: { fontSize:13, color:'#64748B' },
  label: { display:'block', fontSize:11, fontWeight:700, color:'#94A3B8',
    marginBottom:6, textTransform:'uppercase', letterSpacing:'0.8px' },
  input: { width:'100%', padding:'13px 14px', fontSize:14,
    background:'rgba(15,23,42,0.7)', border:'1.5px solid rgba(255,255,255,0.08)',
    borderRadius:12, color:'#F1F5F9', outline:'none', transition:'border-color .2s',
    boxSizing:'border-box', fontFamily:'inherit' },
  btnPrimary: { width:'100%', padding:'14px', fontSize:15, fontWeight:700,
    background:'linear-gradient(135deg,#6B5CFF,#4845D2)',
    color:'white', border:'none', borderRadius:12,
    cursor:'pointer', transition:'all .2s', letterSpacing:.3 },
  btnContent: { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 },
  btnSpinner: {
    width: 14, height: 14, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white',
    animation: 'csSpin 0.8s linear infinite',
  },
  divider: { display:'flex', alignItems:'center', gap:12, margin:'20px 0' },
  divLine: { flex:1, height:1, background:'rgba(255,255,255,0.07)' },
  divText: { fontSize:12, color:'#475569', fontWeight:500 },
  oauthGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:28 },
  oauthBtn: { padding:'11px 10px',
    background:'rgba(15,23,42,0.6)', border:'1.5px solid rgba(255,255,255,0.08)',
    borderRadius:12, color:'#F1F5F9', fontSize:14, fontWeight:600,
    cursor:'pointer', transition:'all .2s', display:'flex',
    alignItems:'center', justifyContent:'center', gap:8, fontFamily:'inherit' },
  link: { color:'#7C6FFF', fontWeight:600, textDecoration:'none' },
  footerLinks: { display:'flex', justifyContent:'center', gap:16,
    paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.05)' },
  footerLink: { fontSize:12, color:'#475569', textDecoration:'none' },
  helpCard: {
    marginTop:14, padding:'12px 14px', borderRadius:12,
    background:'rgba(107,92,255,.08)', border:'1px solid rgba(107,92,255,.18)',
  },
  helpTitle: { fontSize:13, fontWeight:700, color:'#E2E8F0', margin:'0 0 4px' },
  helpText: { fontSize:12, color:'#94A3B8', margin:0, lineHeight:1.5 },
  helpLink: { fontSize:12, color:'#A78BFA', fontWeight:700, textDecoration:'none' },
}

const API_BASE = getApiUrl()
export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const storedContext = getStoredContext()
  const [lang, setLang] = useState((searchParams.get('lang') || storedContext.lang || 'es').slice(0, 2))
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [authGuidance, setAuthGuidance] = useState(null)
  const [hoverGoogle, setHG]      = useState(false)
  const [hoverApple, setHA]       = useState(false)
  const copy = authCopy(lang).login
  const t = key => copy[key] || key
  const ctxQuery = new URLSearchParams({
    country: searchParams.get('country') || storedContext.country || 'AR',
    currency: searchParams.get('currency') || storedContext.currency || 'ARS',
    lang,
  }).toString()
  const registroHref = `/app/registro?${ctxQuery}`

  function clearOAuthParams() {
    const next = new URLSearchParams(searchParams)
    next.delete('oauth')
    next.delete('error')
    next.delete('setup')
    const query = next.toString()
    navigate({ pathname: '/app/login', search: query ? `?${query}` : '' }, { replace: true })
  }

  useEffect(() => {
    const next = (searchParams.get('lang') || getStoredContext().lang || 'es').slice(0, 2)
    setLang(next)
    localStorage.setItem('church_lang', next)
  }, [searchParams])

  async function touchSesion() {
    try { await apiFetch('/sesiones/touch', { method: 'POST' }) } catch {}
  }

  useEffect(() => {
    async function handleOAuthReturn() {
      const oauth = searchParams.get('oauth')
      const error = searchParams.get('error')
      if (oauth === '1') {
        try {
          const res = await apiFetch('/auth/refresh', { method: 'POST', skipAuthRedirect: true })
          localStorage.setItem('token', res.token)
          localStorage.setItem('user', JSON.stringify(res.user))
          syncContextFromUser(res.user)
          if (searchParams.get('setup') === '1') {
            localStorage.setItem('church_force_setup', '1')
          }
          await touchSesion()
          toast.success(copy.ok)
          navigate('/', { replace: true })
        } catch {
          toast.error(copy.authError)
          clearOAuthParams()
        }
      } else if (error) {
        const msgs = copy.errors || {}
        toast.error(msgs[error] || copy.authError)
        clearOAuthParams()
      }
    }
    handleOAuthReturn()
  }, [searchParams, navigate, lang])

  function buildRecoverHref(targetEmail = email) {
    const next = new URLSearchParams({
      ...Object.fromEntries(new URLSearchParams(ctxQuery).entries()),
      email: String(targetEmail || '').trim().toLowerCase(),
    })
    return `/app/recuperar?${next.toString()}`
  }

  function guidanceFromError(message = '', targetEmail = email, code = '') {
    const text = String(message || '')
    const recoverHref = buildRecoverHref(targetEmail)
    if (code === 'AUTH_OAUTH_GOOGLE' || /creada con Google/i.test(text)) {
      return {
        title: 'Esta cuenta usa Google',
        body: 'Ingresá con el botón de Google o restablecé una contraseña si querés entrar con email.',
        linkLabel: 'Restablecer contraseña',
        href: recoverHref,
      }
    }
    if (code === 'AUTH_OAUTH_APPLE' || /creada con Apple/i.test(text)) {
      return {
        title: 'Esta cuenta usa Apple',
        body: 'Ingresá con el botón de Apple o restablecé una contraseña si querés entrar con email.',
        linkLabel: 'Restablecer contraseña',
        href: recoverHref,
      }
    }
    if (code === 'AUTH_PASSWORD_NOT_SET' || /todav[ií]a no tiene contrase/i.test(text) || /Restablecela para ingresar/i.test(text)) {
      return {
        title: 'Configurá una contraseña',
        body: 'La cuenta existe, pero todavía no tiene una contraseña activa para entrar por email.',
        linkLabel: 'Ir a recuperación',
        href: recoverHref,
      }
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    const formData = new FormData(e.currentTarget)
    const nextEmail = String(formData.get('email') || email || '').trim().toLowerCase()
    const nextPassword = String(formData.get('password') || password || '')
    if (!nextEmail || !nextPassword) {
      toast.error('Completá email y contraseña para ingresar.')
      return
    }
    setEmail(nextEmail)
    setPassword(nextPassword)
    setAuthGuidance(null)
    setLoading(true)
    try {
      const res = await apiFetch('/auth/login', { method:'POST', body:JSON.stringify({ email: nextEmail, password: nextPassword }) })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      syncContextFromUser(res.user)
      await touchSesion()
      navigate('/')
    } catch(err) {
      const message = err.message || t('invalid')
      setAuthGuidance(guidanceFromError(message, nextEmail, err.code))
      toast.error(message)
    }
    finally { setLoading(false) }
  }

  function oauthQuery() {
    return new URLSearchParams({
      country: searchParams.get('country') || storedContext.country || 'AR',
      currency: searchParams.get('currency') || storedContext.currency || 'ARS',
      lang,
      plan: searchParams.get('plan') || 'FREE',
      promo: searchParams.get('promo') || storedContext.promo || '',
    }).toString()
  }
  function handleGoogle() { window.location.href = `${API_BASE}/oauth/google?${oauthQuery()}` }
  function handleApple()  { window.location.href = `${API_BASE}/oauth/apple?${oauthQuery()}` }

  return (
    <div style={S.bg}>
      <style>{'@keyframes csSpin{to{transform:rotate(360deg)}}'}</style>
      <div style={S.orb1} />
      <div style={S.orb2} />

      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
            <BrandLogo variant="dark" size={68} wordmark={false} />
          </div>
          <h1 style={S.h1}>Church System</h1>
          <p style={S.sub}>{APP_VERSION_LABEL} · {t('subtitle')}</p>
        </div>

        {/* OAuth primero — más prominente */}
        <div style={S.oauthGrid}>
          <button onClick={handleGoogle} disabled={loading}
            style={{...S.oauthBtn, ...(hoverGoogle ? {background:'rgba(66,133,244,.12)', borderColor:'rgba(66,133,244,.4)'} : {})}}
            onMouseEnter={()=>setHG(true)} onMouseLeave={()=>setHG(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          <button onClick={handleApple} disabled={loading}
            style={{...S.oauthBtn, ...(hoverApple ? {background:'rgba(255,255,255,.06)', borderColor:'rgba(255,255,255,.2)'} : {})}}
            onMouseEnter={()=>setHA(true)} onMouseLeave={()=>setHA(false)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zm-3.02-17c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Apple
          </button>
        </div>

        {/* Divider */}
        <div style={S.divider}>
          <div style={S.divLine}/><span style={S.divText}>{t('divider')}</span><div style={S.divLine}/>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="on">
          <div style={{marginBottom:14}}>
            <label style={S.label}>Email</label>
            <input
              id="login-email"
              name="email"
              autoComplete="username"
              autoCorrect="off"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              type="email" required disabled={loading} value={email}
              onChange={e=>setEmail(e.target.value)} placeholder="vos@iglesia.com"
              style={S.input}
              onFocus={e=>e.target.style.borderColor='#6B5CFF'}
              onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.08)'}/>
          </div>
          <div style={{marginBottom:22, position:'relative'}}>
            <label style={S.label}>{t('password')}</label>
            <div style={{position:'relative'}}>
              <input name="password" autoComplete="current-password"
                id="login-password"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                type={showPass?'text':'password'} required disabled={loading} value={password}
                onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
                style={{...S.input, paddingRight:44}}
                onFocus={e=>e.target.style.borderColor='#6B5CFF'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.08)'}/>
              <button type="button" onClick={()=>setShowPass(!showPass)}
                style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                  background:'none',border:'none',cursor:'pointer',color:'#64748B',display:'flex',padding:4}}>
                {showPass
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                }
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            style={{...S.btnPrimary, opacity: loading ? .7 : 1}}>
            <span style={S.btnContent}>
              {loading && <span style={S.btnSpinner} />}
              <span>{loading ? t('submitting') : t('submit')}</span>
            </span>
          </button>
        </form>

        <p style={{textAlign:'center',margin:'14px 0 0'}}>
          <a href={`/app/recuperar?${ctxQuery}`} style={{...S.footerLink, fontSize:13}}>
            ¿Olvidaste tu contraseña?
          </a>
        </p>

        {authGuidance && (
          <div style={S.helpCard}>
            <p style={S.helpTitle}>{authGuidance.title}</p>
            <p style={S.helpText}>{authGuidance.body}</p>
            <div style={{marginTop:8}}>
              <a href={authGuidance.href} style={S.helpLink}>{authGuidance.linkLabel} →</a>
            </div>
          </div>
        )}

        <p style={{textAlign:'center',fontSize:14,color:'#64748B',margin:'14px 0 0'}}>
          {t('noAccount')}{' '}
          <a href={registroHref} style={S.link}>{t('signup')}</a>
        </p>

        <div style={S.footerLinks}>
          <a href="/app/faq" style={S.footerLink}>FAQ</a>
          <span style={{color:'var(--text-faint)'}}>·</span>
          <a href="/app/terminos" style={S.footerLink}>{t('terms')}</a>
          <span style={{color:'var(--text-faint)'}}>·</span>
          <a href="/app/privacidad" style={S.footerLink}>{t('privacy')}</a>
        </div>
      </div>
    </div>
  )
}
