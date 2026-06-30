import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Users, UserPlus, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { findAccountByCode, getAccountById } from '@/lib/accounts'

const ACCOUNT_STORAGE_KEY = 'handplan_account_id'

export function ClubCodePage() {
  const navigate = useNavigate()
  const { profile, account, setAccount } = useAppStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [pendingMsg, setPendingMsg] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingStored, setCheckingStored] = useState(true)

  useEffect(() => {
    if (profile) {
      navigate('/menu', { replace: true })
      return
    }
    const storedId = localStorage.getItem(ACCOUNT_STORAGE_KEY)
    if (storedId && !account) {
      getAccountById(storedId)
        .then(acc => {
          if (acc && acc.status === 'active') setAccount(acc)
          else localStorage.removeItem(ACCOUNT_STORAGE_KEY)
        })
        .finally(() => setCheckingStored(false))
    } else {
      setCheckingStored(false)
    }
  }, [profile, account, navigate, setAccount])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(false)
    setPendingMsg(false)
    try {
      const found = await findAccountByCode(code)
      if (found && found.status === 'pending') {
        setPendingMsg(true)
      } else if (found) {
        localStorage.setItem(ACCOUNT_STORAGE_KEY, found.id)
        setAccount(found)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (checkingStored) return null

  // ── Pantalla 1: neutral de HandPlan, sin código ingresado todavía ──
  if (!account) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 bg-black">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/pelota-fondo.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/75"/>

        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
              <img src="/logo-handplan.svg" alt="HandPlan" className="w-16 h-16"/>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">HandPlan</h1>
            <p className="text-gray-400 text-sm mt-1.5">Creador de sesiones</p>
          </div>

          <div className="bg-gray-900/90 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur">
            <div className="h-1 bg-emerald-500"/>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <Lock size={17} className="text-emerald-400"/>
                <h2 className="text-base font-bold text-white">Código de acceso</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  value={code}
                  onChange={e => { setCode(e.target.value); setError(false); setPendingMsg(false) }}
                  placeholder="Ingresá tu código"
                  className={`w-full rounded-xl border px-4 py-3 text-sm text-white text-center tracking-widest font-mono uppercase bg-black/40 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors ${
                    error || pendingMsg ? 'border-amber-500' : 'border-gray-700'
                  }`}
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-red-400 text-center">Código incorrecto. Intentá de nuevo.</p>
                )}
                {pendingMsg && (
                  <p className="text-xs text-amber-400 text-center">
                    Tu cuenta todavía está pendiente de aprobación. Te vamos a contactar pronto.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin"/> : null}
                  Ingresar
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-gray-500 text-xs mt-6">
            ¿Todavía no tenés cuenta?{' '}
            <button onClick={() => navigate('/crear-cuenta')} className="text-emerald-400 hover:text-emerald-300 font-medium">
              Creá la tuya
            </button>
          </p>
        </div>
      </div>
    )
  }

  // ── Pantalla 2: cuenta reconocida, vestida con SU identidad ──
  const color = account.primary_color || '#1e8a1e'
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${color}33 0%, ${color} 50%, ${color}cc 100%)` }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/15 border-2 border-white/25 mb-4 overflow-hidden">
            {account.logo_url ? (
              <img src={account.logo_url} alt={account.name} className="w-20 h-20 object-contain"/>
            ) : (
              <img src="/logo-handplan.svg" alt={account.name} className="w-14 h-14"/>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">{account.name}</h1>
          <p className="text-white/60 text-sm mt-1">Planificador de entrenamientos</p>
        </div>

        <div className="space-y-4 animate-slide-up">
          <p className="text-center text-white/70 text-sm mb-6">¿Qué querés hacer?</p>

          <button
            onClick={() => navigate('/registro')}
            className="group w-full flex items-center gap-5 bg-white hover:bg-gray-50 rounded-2xl p-5 text-left shadow-lg transition-all active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1a` }}>
              <UserPlus size={28} style={{ color }}/>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">Crear perfil</p>
              <p className="text-gray-500 text-sm mt-0.5">Registrarse como entrenador</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/perfiles')}
            className="group w-full flex items-center gap-5 bg-black/25 hover:bg-black/35 rounded-2xl p-5 text-left shadow-lg transition-all active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Users size={28} className="text-white"/>
            </div>
            <div>
              <p className="font-bold text-white text-lg">Perfiles</p>
              <p className="text-white/70 text-sm mt-0.5">Seleccioná tu perfil para entrar</p>
            </div>
          </button>

          <button
            onClick={() => {
              localStorage.removeItem(ACCOUNT_STORAGE_KEY)
              setAccount(null)
            }}
            className="w-full text-center text-white/50 hover:text-white text-xs pt-2"
          >
            No es mi club / cambiar código
          </button>
        </div>
      </div>
    </div>
  )
}
