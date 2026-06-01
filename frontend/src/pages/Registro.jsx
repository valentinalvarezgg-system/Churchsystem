import { TEXTOS, EMAILS } from '../utils/legal.js'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, decodeJwt, getApiUrl, getStoredContext, syncContextFromUser } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import EmailVerificacion from '../components/EmailVerificacion.jsx'
import { TokenIglesiaInput } from '../components/TokenIglesia.jsx'
import { authCopy } from '../utils/i18n-auth.js'
import { COMMERCIAL_PLAN_ORDER, getCommercialPlanUi, normalizeCommercialPlan } from '../lib/commercialPlans.js'

const API_BASE = getApiUrl()
const COUNTRIES = [
  { code:'AR', label:'Argentina', currency:'ARS', lang:'es' },
  { code:'BR', label:'Brasil', currency:'BRL', lang:'pt' },
  { code:'CL', label:'Chile', currency:'CLP', lang:'es' },
  { code:'CO', label:'Colombia', currency:'COP', lang:'es' },
  { code:'MX', label:'Mexico', currency:'MXN', lang:'es' },
  { code:'PE', label:'Peru', currency:'PEN', lang:'es' },
  { code:'UY', label:'Uruguay', currency:'UYU', lang:'es' },
  { code:'US', label:'United States', currency:'USD', lang:'en' },
]
const LANGS = [
  { code:'es', label:'Español' },
  { code:'pt', label:'Português' },
  { code:'en', label:'English' },
]

function normalizePlanInput(raw = '') {
  return normalizeCommercialPlan(raw)
}

const REG_I18N = {
  es: {
    steps:['Plan', 'Cuenta', 'Verificar', 'Listo'],
    oauthGoogleOk:'Cuenta creada con Google', oauthMissing:'OAuth no configurado aún',
    passwordMismatch:'Las contraseñas no coinciden', passwordMin:'Mínimo 8 caracteres',
    createError:'Error al crear la cuenta', choosePlanToast:'Elegí un plan para continuar',
    stepCounter:'Paso 1 de 3', choosePlan:'Elegí tu plan',
    chooseSub:'Podés cambiarlo cuando quieras · Todos incluyen 14 días de prueba gratis',
    country:'País', currency:'Divisa', language:'Idioma', invitation:'Invitación',
    popular:'Más popular', selected:'OK Seleccionado', perMonth:'/mes',
    free14:'14 días gratis', free14Copy:'No se cobra nada hasta que termine el período de prueba. Cancelá cuando quieras.',
    continueWith:'Continuar con', aPlan:'un plan', already:'¿Ya tenés cuenta?', signIn:'Ingresar',
    selectedPlan:'Plan seleccionado', change:'Cambiar', quickSignup:'Registrate rápido con', emailOption:'o con email',
    firstName:'Nombre *', lastName:'Apellido', email:'Email *', password:'Contraseña * (mín. 8)',
    confirmPassword:'Confirmar contraseña *', churchCode:'Código de iglesia (opcional)',
    churchHelp:'Pedíselo al pastor. Lo podés agregar después desde Mi Perfil.',
    noCharge:'Sin cobro durante 14 días', afterTrial:'Después del período de prueba se cobra',
    invitationApplied:'Invitación aplicada', cancelBefore:'Cancelá antes si no querés continuar.',
    paymentBy:'El pago se gestiona por MercadoPago.', back:'← Volver', creating:'Creando...',
    createFree:'Crear cuenta gratis →', acceptA:'Acepto los', terms:'Términos y Condiciones', privacyJoin:'la',
    privacy:'Política de Privacidad', cookies:'y la Política de Cookies de Church System.',
    orgNotice:'Church System es una herramienta tecnológica de gestión. La organización es responsable por los datos que carga, los permisos que asigna y las comunicaciones que envía.',
    accountCreated:'¡Cuenta creada!', verificationOk:'Verificación exitosa para', planActivated:'Plan {plan} activado',
    trialActivated:'14 días de prueba gratis', connected:'Conectado a {church}', yourChurch:'tu iglesia', enter:'Ingresar a Church System →',
    footerTerms:'Términos', footerPrivacy:'Privacidad',
  },
  pt: {
    steps:['Plano', 'Conta', 'Verificar', 'Pronto'],
    oauthGoogleOk:'Conta criada com Google', oauthMissing:'OAuth ainda não configurado',
    passwordMismatch:'As senhas não coincidem', passwordMin:'Mínimo de 8 caracteres',
    createError:'Erro ao criar a conta', choosePlanToast:'Escolha um plano para continuar',
    stepCounter:'Passo 1 de 3', choosePlan:'Escolha seu plano',
    chooseSub:'Você pode mudar quando quiser · Todos incluem 14 dias de teste grátis',
    country:'País', currency:'Moeda', language:'Idioma', invitation:'Convite',
    popular:'Mais popular', selected:'OK Selecionado', perMonth:'/mês',
    free14:'14 dias grátis', free14Copy:'Nada será cobrado até o fim do período de teste. Cancele quando quiser.',
    continueWith:'Continuar com', aPlan:'um plano', already:'Já tem conta?', signIn:'Entrar',
    selectedPlan:'Plano selecionado', change:'Alterar', quickSignup:'Cadastre-se rápido com', emailOption:'ou com email',
    firstName:'Nome *', lastName:'Sobrenome', email:'Email *', password:'Senha * (mín. 8)',
    confirmPassword:'Confirmar senha *', churchCode:'Código da igreja (opcional)',
    churchHelp:'Peça ao pastor. Você também pode adicionar depois em Meu Perfil.',
    noCharge:'Sem cobrança por 14 dias', afterTrial:'Depois do período de teste será cobrado',
    invitationApplied:'Convite aplicado', cancelBefore:'Cancele antes se não quiser continuar.',
    paymentBy:'O pagamento é gerenciado pelo MercadoPago.', back:'← Voltar', creating:'Criando...',
    createFree:'Criar conta grátis →', acceptA:'Aceito os', terms:'Termos e Condições', privacyJoin:'a',
    privacy:'Política de Privacidade', cookies:'e a Política de Cookies do Church System.',
    orgNotice:'Church System é uma ferramenta tecnológica de gestão. A organização é responsável pelos dados que carrega, pelas permissões que atribui e pelas comunicações que envia.',
    accountCreated:'Conta criada!', verificationOk:'Verificação bem-sucedida para', planActivated:'Plano {plan} ativado',
    trialActivated:'14 dias de teste grátis', connected:'Conectado a {church}', yourChurch:'sua igreja', enter:'Entrar no Church System →',
    footerTerms:'Termos', footerPrivacy:'Privacidade',
  },
  en: {
    steps:['Plan', 'Account', 'Verify', 'Done'],
    oauthGoogleOk:'Account created with Google', oauthMissing:'OAuth is not configured yet',
    passwordMismatch:'Passwords do not match', passwordMin:'Minimum 8 characters',
    createError:'Error creating account', choosePlanToast:'Choose a plan to continue',
    stepCounter:'Step 1 of 3', choosePlan:'Choose your plan',
    chooseSub:'You can change it anytime · All plans include a 14-day free trial',
    country:'Country', currency:'Currency', language:'Language', invitation:'Invitation',
    popular:'Most popular', selected:'OK Selected', perMonth:'/mo',
    free14:'14 days free', free14Copy:'Nothing is charged until the trial period ends. Cancel anytime.',
    continueWith:'Continue with', aPlan:'a plan', already:'Already have an account?', signIn:'Sign in',
    selectedPlan:'Selected plan', change:'Change', quickSignup:'Sign up quickly with', emailOption:'or with email',
    firstName:'First name *', lastName:'Last name', email:'Email *', password:'Password * (min. 8)',
    confirmPassword:'Confirm password *', churchCode:'Church code (optional)',
    churchHelp:'Ask your pastor. You can also add it later from My Profile.',
    noCharge:'No charge for 14 days', afterTrial:'After the trial period you will be charged',
    invitationApplied:'Invitation applied', cancelBefore:'Cancel before then if you do not want to continue.',
    paymentBy:'Payment is handled by MercadoPago.', back:'← Back', creating:'Creating...',
    createFree:'Create free account →', acceptA:'I accept the', terms:'Terms and Conditions', privacyJoin:'the',
    privacy:'Privacy Policy', cookies:'and Church System Cookie Policy.',
    orgNotice:'Church System is a technology management tool. The organization is responsible for the data it uploads, the permissions it assigns, and the communications it sends.',
    accountCreated:'Account created!', verificationOk:'Successful verification for', planActivated:'Plan {plan} activated',
    trialActivated:'14-day free trial', connected:'Connected to {church}', yourChurch:'your church', enter:'Enter Church System →',
    footerTerms:'Terms', footerPrivacy:'Privacy',
  },
}

const DEFAULT_PLAN_KEYS = COMMERCIAL_PLAN_ORDER

// ── Estilos base ──────────────────────────────────────────────────────────────
const c = {
  bg:     '#0A0E1A',
  surf:   'rgba(30,41,59,0.88)',
  border: 'rgba(255,255,255,0.09)',
  input:  'rgba(15,23,42,0.7)',
  text:   '#F1F5F9',
  text2:  '#CBD5E1',
  muted:  '#64748B',
  pri:    '#6B5CFF',
  priD:   '#4845D2',
  priL:   '#A78BFA',
  ok:     '#22c55e',
}

const inp = {
  width:'100%', padding:'12px 14px', fontSize:14,
  background:c.input, border:`1.5px solid ${c.border}`,
  borderRadius:12, color:c.text, outline:'none',
  transition:'border-color .2s', boxSizing:'border-box',
  fontFamily:'inherit',
}
const btnPri = {
  width:'100%', padding:'14px', fontSize:15, fontWeight:700,
  background:`linear-gradient(135deg,${c.pri},${c.priD})`,
  color:'white', border:'none', borderRadius:12,
  cursor:'pointer', transition:'all .2s', letterSpacing:.3,
}
const label = {
  display:'block', fontSize:11, fontWeight:700, color:'#94A3B8',
  marginBottom:6, textTransform:'uppercase', letterSpacing:'0.8px',
}

// ── Stepper ───────────────────────────────────────────────────────────────────
const STEPS = ['Plan', 'Cuenta', 'Verificar', 'Listo']
function Stepper({ paso, labels=STEPS }) {
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 520
  return (
    <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:32}}>
      {labels.map((l, i) => {
        const done = paso > i, active = paso === i
        return (
          <div key={i} style={{display:'flex', alignItems:'center', flex: i<3?1:0, gap:6}}>
            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
              <div style={{
                width:28, height:28, borderRadius:'50%', fontSize:12, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: done?c.ok : active?c.pri : 'rgba(255,255,255,0.07)',
                color: done||active ? '#fff' : c.muted,
                transition:'all .3s',
              }}>{done ? 'OK' : i+1}</div>
              <span style={{
                fontSize:12, fontWeight: active?700:400,
                color: done?c.ok : active?c.text : c.muted,
                whiteSpace:'nowrap',
                display: isNarrow ? 'none' : 'inline',
              }}>{l}</span>
            </div>
            {i < 3 && (
              <div style={{flex:1, height:2, borderRadius:2, minWidth:8,
                background: done ? c.ok : 'rgba(255,255,255,0.07)',
                transition:'background .3s',
              }}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, justifyContent:'center', marginBottom:8}}>
      <div style={{
        width:40, height:40, borderRadius:12,
        background:`linear-gradient(135deg,#7C6FFF,${c.priD})`,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <svg width="22" height="22" viewBox="0 0 100 100" fill="none">
          <path d="M28 18 Q18 18 18 28 L18 72 Q18 82 28 82 L42 82 Q52 82 52 72 L52 28 Q52 18 42 18 Z" fill="white"/>
          <path d="M58 18 Q48 18 48 28 L48 52 Q48 62 58 62 L72 62 Q82 62 82 52 L82 28 Q82 18 72 18 Z" fill="white" opacity="0.85"/>
        </svg>
      </div>
      <span style={{fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:18, color:c.text}}>
        Church System
      </span>
    </div>
  )
}

// ── OAuth botones ─────────────────────────────────────────────────────────────
function OAuthButtons({ label='Registrate' }) {
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
      <button onClick={()=>{ window.location.href=`${API_BASE}/oauth/google` }}
        style={{
          padding:'12px 10px', background:'rgba(66,133,244,.10)',
          border:'1.5px solid rgba(66,133,244,.3)', borderRadius:12,
          color:c.text, fontSize:14, fontWeight:600, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          fontFamily:'inherit', transition:'all .2s',
        }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(66,133,244,.18)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(66,133,244,.10)'}>
        <svg width="17" height="17" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google
      </button>
      <button onClick={()=>{ window.location.href=`${API_BASE}/oauth/apple` }}
        style={{
          padding:'12px 10px', background:'rgba(255,255,255,.05)',
          border:`1.5px solid ${c.border}`, borderRadius:12,
          color:c.text, fontSize:14, fontWeight:600, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          fontFamily:'inherit', transition:'all .2s',
        }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.1)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zm-3.02-17c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
        Apple
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Registro() {
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()

  const [paso, setPaso]           = useState(0)
  const [planSel, setPlanSel]     = useState(normalizePlanInput(searchParams.get('plan')) || '')
  const storedContext = getStoredContext()
  const initialCountry = (searchParams.get('country') || storedContext.country || 'AR').toUpperCase()
  const initialCountryInfo = COUNTRIES.find(c => c.code === initialCountry) || COUNTRIES[0]
  const [country, setCountry]     = useState(initialCountryInfo.code)
  const [currency, setCurrency]   = useState((searchParams.get('currency') || storedContext.currency || initialCountryInfo.currency).toUpperCase())
  const [lang, setLang]           = useState((searchParams.get('lang') || storedContext.lang || initialCountryInfo.lang).slice(0,2))
  const [promo, setPromo]         = useState((searchParams.get('promo') || storedContext.promo || '').toUpperCase())
  const [planPrices, setPlanPrices] = useState({})
  const [planCatalog, setPlanCatalog] = useState([])
  const [loading, setLoading]     = useState(false)
  const [emailReg, setEmailReg]   = useState('')
  const [nombreReg, setNombreReg] = useState('')
  const [iglesiaJoin, setIglesiaJoin] = useState(null)
  const [showPass, setShowPass]   = useState(false)
  const [showPass2, setShowPass2] = useState(false)
  const [aceptoTerminos, setAceptoTerminos] = useState(false)
  const [form, setForm]           = useState({ nombre:'', apellido:'', email:'', password:'', confirmar:'', iglesiaToken:'' })
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  // Si viene con token OAuth (redirect de vuelta)
  useEffect(() => {
    async function handleOAuthReturn() {
      const token = searchParams.get('token')
      const error = searchParams.get('error')
      if (token) {
        localStorage.setItem('token', token)
        try {
          const user = await apiFetch('/auth/me')
          localStorage.setItem('user', JSON.stringify(user))
          syncContextFromUser(user)
        } catch {
          const decoded = decodeJwt(token)
          if (decoded) {
            localStorage.setItem('user', JSON.stringify(decoded))
            syncContextFromUser(decoded)
          }
        }
        toast.success((REG_I18N[lang] || REG_I18N.es).oauthGoogleOk)
        navigate('/')
      } else if (error === 'oauth_not_configured') {
        toast.error((REG_I18N[lang] || REG_I18N.es).oauthMissing)
      }
    }
    handleOAuthReturn()
  }, [searchParams, navigate, lang])

  useEffect(() => {
    const selected = COUNTRIES.find(c => c.code === country) || COUNTRIES[0]
    if (selected.currency !== currency) setCurrency(selected.currency)
    if (!searchParams.get('lang')) setLang(selected.lang)
    localStorage.setItem('church_country', selected.code)
    localStorage.setItem('church_currency', selected.currency)
    localStorage.setItem('church_lang', searchParams.get('lang') || selected.lang)
  }, [country])

  useEffect(() => {
    localStorage.setItem('church_lang', lang)
    localStorage.setItem('church_currency', currency)
    if (promo) localStorage.setItem('church_promo', promo)
    apiFetch(`/mp/planes?country=${country}&lang=${lang}`, { skipAuthRedirect: true })
      .then(list => {
        const normalizedList = Array.isArray(list) ? list : []
        const prices = Object.fromEntries(normalizedList.map(p => [String(p.id || '').toUpperCase(), p]))
        setPlanPrices(prices)
        setPlanCatalog(normalizedList)
      })
      .catch(() => {})
  }, [country, currency, lang, promo])

  async function handleRegistro(e) {
    e.preventDefault()
    const msg = REG_I18N[lang] || REG_I18N.es
    if (form.password !== form.confirmar) { toast.error(msg.passwordMismatch); return }
    if (form.password.length < 8) { toast.error(msg.passwordMin); return }
    setLoading(true)
    try {
      await apiFetch('/auth/registro', { method:'POST', body:JSON.stringify({
        nombre:form.nombre, apellido:form.apellido,
        email:form.email.toLowerCase(), password:form.password,
        plan: planSel || 'PRO',
        pais: country,
        divisa: currency,
        idioma: lang,
        promo: promo || undefined,
        iglesiaToken: form.iglesiaToken || undefined,
      })})
      setEmailReg(form.email.toLowerCase())
      setNombreReg(form.nombre)
      setPaso(2)
    } catch(e) { toast.error(e.message || msg.createError) }
    finally { setLoading(false) }
  }

  const availablePlans = DEFAULT_PLAN_KEYS
    .map(key => {
      const server = planPrices[key] || {}
      const ui = getCommercialPlanUi(key, lang)
      return {
        key,
        featured: !!server.featured || ui.badge === 'Más popular',
        free: !!server.free,
        audience: server.audience || ui.group,
        personas: Number(server.personas || 0),
        includedWhatsApp: Number(server.includedWhatsApp || 0),
        includedSms: Number(server.includedSms || 0),
        currency: server.currency || currency,
        price: Number(server.precio ?? 0),
        label: server.label || ui.name,
        description: server.description || ui.description,
        badge: ui.badge || '',
        features: ui.features,
      }
    })
    .filter(plan => planCatalog.length === 0 || planCatalog.some(item => item.id === plan.key))

  const planActual = availablePlans.find(p=>p.key === planSel) || availablePlans.find(p => p.key === 'PRO') || availablePlans[0]
  const leadershipPlans = availablePlans.filter(plan => plan.audience === 'individual' || plan.audience === 'leadership')
  const churchPlans = availablePlans.filter(plan => plan.audience === 'church')
  const priceFor = plan => Number(plan?.price ?? 0)
  const currencyFor = plan => plan?.currency || currency
  const messages = REG_I18N[lang] || REG_I18N.es
  const t = key => messages[key] || REG_I18N.es[key] || key
  const planName = plan => plan?.label || getCommercialPlanUi(plan?.key || 'PRO', lang).name
  const planFeatures = plan => plan?.features || getCommercialPlanUi(plan?.key || 'PRO', lang).features
  const planDescription = plan => plan?.description || getCommercialPlanUi(plan?.key || 'PRO', lang).description
  const planBadge = plan => plan?.badge || ''
  const planIsPopular = plan => plan?.featured || planBadge(plan) === 'Más popular'
  const isFreePlan = planActual?.free || planActual?.key === 'FREE'

  // ── Card wrapper ──────────────────────────────────────────────────────────
  const cardW = paso===0 ? 920 : paso===1 ? 500 : 440
  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:c.bg, padding:'24px 16px', position:'relative', overflow:'hidden',
      fontFamily:"'Inter','Sora',sans-serif",
    }}>
      {/* Orbs */}
      <div style={{position:'fixed', width:500, height:500, borderRadius:'50%',
        background:c.pri, filter:'blur(120px)', opacity:.09, top:-150, right:-100, pointerEvents:'none'}}/>
      <div style={{position:'fixed', width:350, height:350, borderRadius:'50%',
        background:'#06B6D4', filter:'blur(120px)', opacity:.07, bottom:'10%', left:-80, pointerEvents:'none'}}/>

      {/* Logo top */}
      <div style={{marginBottom:20}}><Logo/></div>

      <div style={{
        width:'100%', maxWidth:cardW,
        background:c.surf, backdropFilter:'blur(24px)',
        borderRadius:24, padding: paso===0 ? '24px 18px' : '28px 18px',
        border:`1px solid ${c.border}`,
        boxShadow:'0 30px 60px -12px rgba(0,0,0,0.6)',
        transition:'max-width .4s ease',
      }}>

        {/* Stepper (pasos 1-3) */}
        {paso > 0 && <Stepper paso={paso} labels={t('steps')}/>}

        {/* ══ PASO 0: ELEGIR PLAN ══════════════════════════════════════════════ */}
        {paso === 0 && (
          <>
            <div style={{textAlign:'center', marginBottom:32}}>
              <div style={{fontSize:12, fontWeight:700, textTransform:'uppercase',
                letterSpacing:2, color:c.pri, marginBottom:8}}>{t('stepCounter')}</div>
              <h2 style={{fontFamily:"'Sora',sans-serif", fontSize:26, fontWeight:800,
                color:c.text, margin:'0 0 6px'}}>{t('choosePlan')}</h2>
              <p style={{fontSize:14, color:c.muted}}>
                {lang === 'pt'
                  ? 'Escolha entre liderança individual ou operação completa da igreja.'
                  : lang === 'en'
                    ? 'Choose between individual leadership or full church operations.'
                    : 'Elegí entre liderazgo individual u operación completa para tu iglesia.'}
              </p>
            </div>

            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',
              gap:12,
              marginBottom:22,
              background:'rgba(15,23,42,.55)',
              border:`1px solid ${c.border}`,
              borderRadius:14,
              padding:14,
            }}>
              <div>
                <label style={label}>{t('country')}</label>
                <select value={country} onChange={e=>setCountry(e.target.value)} style={inp}>
                  {COUNTRIES.map(item => (
                    <option key={item.code} value={item.code}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>{t('currency')}</label>
                <input value={currency} readOnly style={{...inp, opacity:.8}} />
              </div>
              <div>
                <label style={label}>{t('language')}</label>
                <select value={lang} onChange={e=>setLang(e.target.value)} style={inp}>
                  {LANGS.map(item => (
                    <option key={item.code} value={item.code}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>{t('invitation')}</label>
                <input value={promo} onChange={e=>setPromo(e.target.value.toUpperCase())} placeholder="15OFF" style={{...inp, textTransform:'uppercase'}} />
              </div>
            </div>

            {[{
              key: 'leadership',
              title: lang === 'pt' ? 'Planos para líderes' : lang === 'en' ? 'Plans for leaders' : 'Planes para líderes',
              subtitle: lang === 'pt' ? 'Ideal para acompanhar pessoas, grupos e check-ins sem complexidade.' : lang === 'en' ? 'Ideal for people, groups, and check-ins without heavy setup.' : 'Ideal para acompañar personas, grupos y check-ins sin complejidad.',
              plans: leadershipPlans,
            }, {
              key: 'church',
              title: lang === 'pt' ? 'Planos para igrejas' : lang === 'en' ? 'Plans for churches' : 'Planes para iglesias',
              subtitle: lang === 'pt' ? 'Pensado para congregações com operação semanal, comunicações e equipe.' : lang === 'en' ? 'Built for congregations with weekly operations, communications, and teams.' : 'Pensado para congregaciones con operación semanal, comunicaciones y equipo.',
              plans: churchPlans,
            }].map(section => (
              <div key={section.key} style={{ marginBottom: 22 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: c.priL }}>
                    {section.title}
                  </div>
                  <div style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>{section.subtitle}</div>
                </div>
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))',
                  gap:12,
                  marginBottom:10,
                }}>
                  {section.plans.map(plan => {
                    const sel = planSel === plan.key
                    return (
                      <div key={plan.key}
                        onClick={()=>setPlanSel(plan.key)}
                        style={{
                          border:`2px solid ${sel ? c.pri : planIsPopular(plan) ? 'rgba(107,92,255,.3)' : c.border}`,
                          borderRadius:16, padding:'20px 16px', cursor:'pointer',
                          background: sel ? `rgba(107,92,255,.12)` : planIsPopular(plan) ? 'rgba(107,92,255,.05)' : 'rgba(255,255,255,.02)',
                          position:'relative', transition:'all .2s',
                        }}>
                        {planIsPopular(plan) && !sel && (
                          <div style={{
                            position:'absolute', top:-11, left:'50%', transform:'translateX(-50%)',
                            background:`linear-gradient(135deg,${c.pri},${c.priD})`,
                            color:'white', fontSize:10, fontWeight:700,
                            padding:'2px 10px', borderRadius:100, whiteSpace:'nowrap',
                          }}>{planBadge(plan) || t('popular')}</div>
                        )}
                        {sel && (
                          <div style={{
                            position:'absolute', top:-11, left:'50%', transform:'translateX(-50%)',
                            background:`linear-gradient(135deg,${c.pri},${c.priD})`,
                            color:'white', fontSize:10, fontWeight:700,
                            padding:'2px 10px', borderRadius:100,
                          }}>{t('selected')}</div>
                        )}
                        <div style={{fontFamily:"'Sora',sans-serif", fontSize:15, fontWeight:800,
                          color: sel ? c.priL : c.text, marginBottom:4}}>{planName(plan)}</div>
                        <div style={{
                          fontFamily:"'Sora',sans-serif", fontSize:26, fontWeight:800,
                          color: sel ? c.pri : c.text2, marginBottom:4,
                        }}>
                          {plan.free ? '0' : `${currencyFor(plan)} ${priceFor(plan)}`}<span style={{fontSize:12, fontWeight:400, color:c.muted}}>{plan.free ? '' : t('perMonth')}</span>
                        </div>
                        <div style={{fontSize:11, color:c.muted, marginBottom:12}}>{planDescription(plan)}</div>
                        <ul style={{listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:5}}>
                          {planFeatures(plan).map(f => (
                            <li key={f} style={{fontSize:12, color: sel ? c.text2 : c.muted,
                              display:'flex', alignItems:'flex-start', gap:6}}>
                              <span style={{color: sel ? c.ok : '#374151', flexShrink:0, fontSize:11, marginTop:1}}>OK</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Info 14 días */}
            <div style={{
              background: isFreePlan ? 'rgba(59,130,246,.10)' : 'rgba(34,197,94,.08)',
              border: isFreePlan ? '1px solid rgba(59,130,246,.25)' : '1px solid rgba(34,197,94,.2)',
              borderRadius:12, padding:'12px 16px', marginBottom:24,
              display:'flex', alignItems:'center', gap:10, fontSize:13,
            }}>
              <span style={{fontSize:20}}>{isFreePlan ? 'Gratis' : ''}</span>
              <div>
                <strong style={{color:isFreePlan ? '#60A5FA' : c.ok}}>
                  {isFreePlan
                    ? (lang === 'pt' ? 'Sem cobrança inicial' : lang === 'en' ? 'No upfront charge' : 'Sin cobro inicial')
                    : t('free14')}
                </strong>
                <span style={{color:c.muted}}>
                  {' '}— {isFreePlan
                    ? (lang === 'pt'
                        ? 'Perfeito para experimentar o sistema, com branding Church System e limites claros para fazer upgrade.'
                        : lang === 'en'
                          ? 'Perfect to try the system, with Church System branding and clear upgrade limits.'
                          : 'Perfecto para probar el sistema, con branding Church System y límites claros para subir de plan.')
                    : t('free14Copy')}
                </span>
              </div>
            </div>

            <button
              onClick={()=>{ if(!planSel) { toast.error(t('choosePlanToast')); return } setPaso(1) }}
              style={{...btnPri, opacity: planSel ? 1 : .5}}>
              {t('continueWith')} {planSel ? planName(planActual) : t('aPlan')} →
            </button>

            <p style={{textAlign:'center', fontSize:13, color:c.muted, marginTop:16}}>
              {t('already')}{' '}
              <a href="/app/login" style={{color:c.pri, fontWeight:600, textDecoration:'none'}}>{authCopy(lang).register.signIn}</a>
            </p>
          </>
        )}

        {/* ══ PASO 1: CREAR CUENTA ═════════════════════════════════════════════ */}
        {paso === 1 && (
          <>
            {/* Plan badge */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              background:'rgba(107,92,255,.1)', border:'1px solid rgba(107,92,255,.2)',
              borderRadius:12, padding:'10px 14px', marginBottom:24,
            }}>
              <div>
                <span style={{fontSize:12, color:c.muted}}>{t('selectedPlan')} · </span>
                <strong style={{fontSize:13, color:c.priL}}>{planName(planActual)}</strong>
                <span style={{fontSize:12, color:c.muted}}>
                  {' · '}
                  {isFreePlan ? (lang === 'pt' ? 'Gratis' : lang === 'en' ? 'Free' : 'Gratis') : `${currencyFor(planActual)} ${priceFor(planActual)}${t('perMonth')}`}
                </span>
              </div>
              <button onClick={()=>setPaso(0)}
                style={{background:'none', border:'none', cursor:'pointer',
                  fontSize:12, color:c.pri, fontWeight:600, padding:0}}>
                {t('change')}
              </button>
            </div>

            {/* OAuth */}
            <div style={{marginBottom:20}}>
              <p style={{fontSize:13, color:c.muted, marginBottom:12, textAlign:'center'}}>
                {t('quickSignup')}
              </p>
              <OAuthButtons label="Registrate"/>
            </div>

            {/* Divider */}
            <div style={{display:'flex', alignItems:'center', gap:12, margin:'20px 0'}}>
              <div style={{flex:1, height:1, background:'rgba(255,255,255,.07)'}}/>
              <span style={{fontSize:12, color:'#475569'}}>{t('emailOption')}</span>
              <div style={{flex:1, height:1, background:'rgba(255,255,255,.07)'}}/>
            </div>

            {/* Form */}
            <form onSubmit={handleRegistro} style={{display:'flex', flexDirection:'column', gap:13}}>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12}}>
                <div>
                  <label style={label}>{t('firstName')}</label>
                  <input type="text" required value={form.nombre} placeholder="Juan"
                    style={inp} onChange={e=>f('nombre',e.target.value)}
                    onFocus={e=>e.target.style.borderColor=c.pri}
                    onBlur={e=>e.target.style.borderColor=c.border}/>
                </div>
                <div>
                  <label style={label}>{t('lastName')}</label>
                  <input type="text" value={form.apellido} placeholder="Pérez"
                    style={inp} onChange={e=>f('apellido',e.target.value)}
                    onFocus={e=>e.target.style.borderColor=c.pri}
                    onBlur={e=>e.target.style.borderColor=c.border}/>
                </div>
              </div>
              <div>
                <label style={label}>{t('email')}</label>
                <input type="email" required value={form.email} placeholder="vos@iglesia.com"
                  style={inp} onChange={e=>f('email',e.target.value)}
                  onFocus={e=>e.target.style.borderColor=c.pri}
                  onBlur={e=>e.target.style.borderColor=c.border}/>
              </div>
              <div>
                <label style={label}>{t('password')}</label>
                <div style={{position:'relative'}}>
                  <input type={showPass?'text':'password'} required minLength={8}
                    value={form.password} placeholder="••••••••"
                    style={{...inp, paddingRight:40}} onChange={e=>f('password',e.target.value)}
                    onFocus={e=>e.target.style.borderColor=c.pri}
                    onBlur={e=>e.target.style.borderColor=c.border}/>
                  <button type="button" onClick={()=>setShowPass(!showPass)}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                      background:'none',border:'none',cursor:'pointer',color:c.muted,display:'flex',padding:4}}>
                    {showPass
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                  </button>
                </div>
              </div>
              <div>
                <label style={label}>{t('confirmPassword')}</label>
                <div style={{position:'relative'}}>
                  <input type={showPass2?'text':'password'} required
                    value={form.confirmar} placeholder="••••••••"
                    style={{...inp, paddingRight:40,
                      borderColor: form.confirmar && form.confirmar!==form.password ? '#ef4444' : c.border}}
                    onChange={e=>f('confirmar',e.target.value)}
                    onFocus={e=>e.target.style.borderColor=c.pri}
                    onBlur={e=>e.target.style.borderColor= form.confirmar&&form.confirmar!==form.password?'#ef4444':c.border}/>
                  <button type="button" onClick={()=>setShowPass2(!showPass2)}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                      background:'none',border:'none',cursor:'pointer',color:c.muted,display:'flex',padding:4}}>
                    {showPass2
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                  </button>
                </div>
                {form.confirmar && form.confirmar!==form.password &&
                  <p style={{fontSize:11,color:'#ef4444',marginTop:4}}>{t('passwordMismatch')}</p>}
              </div>

              {/* Token iglesia */}
              <div style={{
                background:'rgba(107,92,255,.06)',
                border:`1px solid rgba(107,92,255,.15)`,
                borderRadius:12, padding:'14px 16px',
              }}>
                <TokenIglesiaInput
                  label={t('churchCode')}
                  onSuccess={res=>{ setIglesiaJoin(res); f('iglesiaToken', res?.token||'') }}
                />
                <p style={{fontSize:11,color:c.muted,marginTop:6}}>
                  {t('churchHelp')}
                </p>
              </div>

              {/* Info pago */}
              <div style={{
                background:'rgba(15,23,42,.6)', border:`1px solid ${c.border}`,
                borderRadius:12, padding:'14px 16px',
                display:'flex', gap:12, alignItems:'flex-start',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="#22c55e" strokeWidth="2" style={{flexShrink:0, marginTop:1}}>
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <div>
                  <p style={{fontSize:13, color:c.text2, margin:'0 0 4px', fontWeight:600}}>
                    {isFreePlan
                      ? (lang === 'pt' ? 'Ativação imediata sem cobrança' : lang === 'en' ? 'Immediate activation with no charge' : 'Activación inmediata sin cobro')
                      : t('noCharge')}
                  </p>
                  <p style={{fontSize:12, color:c.muted, margin:0, lineHeight:1.5}}>
                    {isFreePlan
                      ? (lang === 'pt'
                          ? 'Você começa com o plano Free e pode subir para um plano pago quando precisar de mais usuários, comunicações ou automações.'
                          : lang === 'en'
                            ? 'You start on the Free plan and can upgrade later when you need more users, communications, or automations.'
                            : 'Empezás con el plan Free y podés subir a un plan pago cuando necesites más usuarios, comunicaciones o automatizaciones.')
                      : <>{t('afterTrial')} <strong style={{color:c.text2}}>{currencyFor(planActual)} {priceFor(planActual)}{t('perMonth')}</strong>.</>}
                    {promo ? <span> {t('invitationApplied')}: <strong style={{color:c.text2}}>{promo}</strong>.</span> : null}
                    {!isFreePlan && <>{' '}{t('cancelBefore')} {' '}{t('paymentBy')}</>}
                  </p>
                </div>
              </div>

              <div style={{display:'flex', gap:10}}>
                <button type="button" onClick={()=>setPaso(0)}
                  style={{flex:1, padding:'13px', fontSize:14, fontWeight:600,
                    background:'rgba(255,255,255,.06)', color:c.text2,
                    border:`1px solid ${c.border}`, borderRadius:12, cursor:'pointer'}}>
                  {t('back')}
                </button>
                <button type="submit" disabled={loading||(form.confirmar&&form.confirmar!==form.password)||!aceptoTerminos}
                  style={{...btnPri, flex:2, opacity:(loading||!aceptoTerminos)?0.5:1}}>
                  {loading
                    ? t('creating')
                    : isFreePlan
                      ? (lang === 'pt' ? 'Criar conta Free →' : lang === 'en' ? 'Create Free account →' : 'Crear cuenta Free →')
                      : t('createFree')}
                </button>
              </div>

              {/* Checkbox legal */}
              <label style={{display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', marginTop:4}}>
                <input type="checkbox" checked={aceptoTerminos} onChange={e=>setAceptoTerminos(e.target.checked)}
                  style={{marginTop:2, accentColor:c.pri, flexShrink:0, width:16, height:16}}/>
                <span style={{fontSize:12, color:c.muted, lineHeight:1.5}}>
                  {t('acceptA')}{' '}
                  <a href="/app/terminos" style={{color:c.pri, textDecoration:'none'}} target="_blank">{t('terms')}</a>,
                  {' '}{t('privacyJoin')}{' '}
                  <a href="/app/privacidad" style={{color:c.pri, textDecoration:'none'}} target="_blank">{t('privacy')}</a>
                  {' '}{t('cookies')}
                </span>
              </label>

              {/* Aviso organización */}
              <div style={{fontSize:11, color:c.muted, lineHeight:1.6, padding:'10px 12px',
                background:'rgba(255,255,255,0.03)', borderRadius:10, border:`1px solid ${c.border}`}}>
                {t('orgNotice')}
              </div>
            </form>
          </>
        )}

        {/* ══ PASO 2: VERIFICACIÓN EMAIL ═══════════════════════════════════════ */}
        {paso === 2 && (
          <EmailVerificacion
            email={emailReg}
            nombre={nombreReg}
            onVerificado={()=>setPaso(3)}
          />
        )}

        {/* ══ PASO 3: LISTO ════════════════════════════════════════════════════ */}
        {paso === 3 && (
          <div style={{textAlign:'center', padding:'12px 0'}}>
            <div style={{
              width:80, height:80, borderRadius:24, margin:'0 auto 24px',
              background:'linear-gradient(135deg,#22c55e,#16a34a)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:40,
            }}>OK</div>
            <h2 style={{fontFamily:"'Sora',sans-serif", fontSize:24, fontWeight:800,
              color:c.text, margin:'0 0 8px'}}>
              {t('accountCreated')}
            </h2>
            <p style={{fontSize:14, color:c.muted, margin:'0 0 6px', lineHeight:1.6}}>
              {t('verificationOk')}<br/>
              <strong style={{color:c.text2}}>{emailReg}</strong>
            </p>
            <div style={{
              display:'flex', flexDirection:'column', gap:10, margin:'24px 0',
              background:'rgba(255,255,255,.03)', borderRadius:14, padding:'16px',
            }}>
              {[
                { icon:'OK', text:t('planActivated').replace('{plan}', planName(planActual)), color:c.ok },
                { icon:'', text:t('trialActivated'), color:'#f59e0b' },
                iglesiaJoin && { icon:'OK', text:t('connected').replace('{church}', iglesiaJoin.iglesia?.nombre||iglesiaJoin.nombre||t('yourChurch')), color:c.ok },
              ].filter(Boolean).map((item,i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:10,
                  fontSize:13, color:item.color, fontWeight:600}}>
                  <span style={{fontSize:16}}>{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>
            <button onClick={()=>navigate('/login')} style={btnPri}>
              {t('enter')}
            </button>
          </div>
        )}

      </div>

      {/* Footer links */}
      <div style={{display:'flex', gap:16, marginTop:20}}>
        {[`FAQ:/app/faq`,`${t('footerTerms')}:/app/terminos`,`${t('footerPrivacy')}:/app/privacidad`].map(x => {
          const [label, href] = x.split(':')
          return <a key={label} href={href}
            style={{fontSize:12, color:c.muted, textDecoration:'none'}}>{label}</a>
        })}
      </div>
    </div>
  )
}
