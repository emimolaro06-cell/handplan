import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Users, UserPlus } from 'lucide-react'
import { CLUB_CODE, CLUB_NAME } from '@/lib/constants'
import { useAppStore } from '@/lib/store'

const CLUB_CODE_STORAGE_KEY = 'dyj_club_code_verified'

export function ClubCodePage() {
  const navigate = useNavigate()
  const { profile } = useAppStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    // Si ya hay una sesión de perfil activa, no tiene sentido mostrar esta pantalla: directo al menú
    if (profile) {
      navigate('/menu', { replace: true })
      return
    }
    // Si el código ya fue verificado antes en este dispositivo, saltar directo a las opciones
    if (localStorage.getItem(CLUB_CODE_STORAGE_KEY) === 'true') {
      setUnlocked(true)
    }
  }, [profile, navigate])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().toUpperCase() === CLUB_CODE) {
      localStorage.setItem(CLUB_CODE_STORAGE_KEY, 'true')
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #072d07 0%, #1e8a1e 50%, #0d420d 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gold-400/20 border-2 border-gold-400/40 mb-4 overflow-hidden">
            <img src="/logo-dj.png" alt="Logo" className="w-20 h-20 object-contain"/>
          </div>
          <h1 className="text-2xl font-bold text-white font-display tracking-wide">
            {CLUB_NAME}
          </h1>
          <p className="text-white/50 text-sm mt-1">Planificador de Entrenamientos</p>
        </div>

        {!unlocked ? (
          /* ── Ingresar código ── */
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-dj-700 via-gold-400 to-dj-700"/>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <Lock size={18} className="text-dj-600"/>
                <h2 className="text-lg font-bold text-gray-900">Código del club</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  value={code}
                  onChange={e => { setCode(e.target.value); setError(false) }}
                  placeholder="Ingresá el código"
                  className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-900 text-center tracking-widest font-mono uppercase focus:outline-none focus:ring-2 focus:ring-dj-400 transition-colors ${
                    error ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-red-600 text-center">Código incorrecto. Intentá de nuevo.</p>
                )}
                <button
                  type="submit"
                  className="w-full bg-dj-600 hover:bg-dj-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Ingresar
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* ── Dos opciones ── */
          <div className="space-y-4 animate-slide-up">
            <p className="text-center text-white/70 text-sm mb-6">
              ¿Qué querés hacer?
            </p>

            {/* Crear perfil */}
            <button
              onClick={() => navigate('/registro')}
              className="group w-full flex items-center gap-5 bg-gold-400 hover:bg-gold-500 rounded-2xl p-5 text-left shadow-lg transition-all active:scale-[0.98]"
            >
              <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center flex-shrink-0">
                <UserPlus size={28} className="text-gray-900"/>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Crear perfil</p>
                <p className="text-gray-700 text-sm mt-0.5">Registrarse como entrenador</p>
              </div>
            </button>

            {/* Ver perfiles */}
            <button
              onClick={() => navigate('/perfiles')}
              className="group w-full flex items-center gap-5 bg-dj-700 hover:bg-dj-800 rounded-2xl p-5 text-left shadow-lg transition-all active:scale-[0.98]"
            >
              <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Users size={28} className="text-white"/>
              </div>
              <div>
                <p className="font-bold text-white text-lg">Perfiles</p>
                <p className="text-white/70 text-sm mt-0.5">Seleccioná tu perfil para entrar</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
