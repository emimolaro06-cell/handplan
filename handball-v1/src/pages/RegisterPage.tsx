import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Check, Shield } from 'lucide-react'
import { signUpWithUsername, supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { TEAM_CATEGORIES, AVATAR_COLORS } from '@/lib/constants'
import type { TeamCategory } from '@/types'

const ADMIN_CODE = 'ADMIN2026'

interface RegForm {
  full_name: string
  username: string
  admin_code?: string
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { setProfile, account } = useAppStore()
  const [selectedCats, setSelectedCats] = useState<TeamCategory[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  const [showAdminCode, setShowAdminCode] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegForm>()

  function toggleCat(cat: TeamCategory) {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  async function onSubmit({ full_name, username, admin_code }: RegForm) {
    if (!account) { setServerError('No se reconoció ninguna cuenta. Volvé a ingresar tu código.'); return }
    if (selectedCats.length === 0) { setServerError('Seleccioná al menos una categoría.'); return }
    setServerError(null)

    const isAdmin = admin_code?.trim() === ADMIN_CODE
    const role = isAdmin ? 'admin' : 'coach'

    // El patrón de credenciales se deriva del access_code de la cuenta, así cada cuenta nueva
    // tiene el suyo propio automáticamente. Para Defensa y Justicia se mantiene EXACTAMENTE
    // el patrón original (@hbdj.internal / DYJ_..._2025) para no romper nada ya creado.
    const isLegacyDyJ = account.access_code === 'DYJHANDBALL2025'
    const autoPassword = isLegacyDyJ
      ? `DYJ_${username}_2025`
      : `${account.access_code}_${username}`
    const emailDomain = isLegacyDyJ ? 'hbdj.internal' : `${account.access_code.toLowerCase()}.internal`

    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]

    const { data, error } = await signUpWithUsername(username, autoPassword, {
      full_name, role, club_name: account.name, avatar_color: avatarColor, email_domain: emailDomain,
    })

    if (error || !data.user) {
      setServerError(error?.message?.includes('already') ? 'Ese usuario ya existe.' : 'Error al crear el perfil.')
      return
    }

    await supabase.from('profiles')
      .update({ categories: selectedCats, avatar_color: avatarColor, role, account_id: account.id })
      .eq('id', data.user.id)

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    if (profile) { setProfile(profile); navigate(isAdmin ? '/admin' : '/categoria') }
  }

  const baseCats = ['Minis', 'Infantiles', 'Menores', 'Cadetes', 'Juveniles', 'Primera']
  const color = account?.primary_color || '#1e8a1e'

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${color}33 0%, ${color} 50%, ${color}cc 100%)` }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="text-white/60 hover:text-white"><ArrowLeft size={20}/></button>
          <div>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest">{account?.name}</p>
            <h1 className="text-xl font-bold text-white font-display">Crear perfil</h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5" style={{ background: `linear-gradient(to right, ${color}, ${color}aa, ${color})` }}/>
          <div className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Nombre completo</label>
                <input placeholder="Ej: Emanuel García"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
                  {...register('full_name', { required: 'Obligatorio' })}/>
                {errors.full_name && <p className="text-xs text-red-600">{errors.full_name.message}</p>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Nombre de usuario</label>
                <input placeholder="Ej: emi_garcia"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
                  {...register('username', {
                    required: 'Obligatorio',
                    pattern: { value: /^[a-zA-Z0-9_]+$/, message: 'Solo letras, números y guión bajo' }
                  })}/>
                {errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}
              </div>

              {/* Categorías */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Mis categorías <span className="text-gray-400 font-normal">(seleccioná las tuyas)</span>
                </label>
                <div className="space-y-2">
                  {baseCats.map(base => (
                    <div key={base} className="flex gap-2">
                      {(['A', 'B'] as const).map(letra => {
                        const cat = `${base} ${letra}` as TeamCategory
                        const sel = selectedCats.includes(cat)
                        return (
                          <button key={cat} type="button" onClick={() => toggleCat(cat)}
                            className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                              sel ? 'bg-dj-600 border-dj-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-dj-400'
                            }`}>
                            {cat} {sel && <Check size={14}/>}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
                {selectedCats.length > 0 && (
                  <p className="text-xs text-dj-600 mt-2 font-medium">
                    ✓ {selectedCats.length} categoría{selectedCats.length > 1 ? 's' : ''} seleccionada{selectedCats.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Código admin (opcional) */}
              <div>
                <button type="button" onClick={() => setShowAdminCode(!showAdminCode)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  <Shield size={12}/>
                  {showAdminCode ? 'Ocultar código de administrador' : '¿Sos administrador?'}
                </button>
                {showAdminCode && (
                  <div className="mt-2">
                    <input type="password" placeholder="Código de administrador"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
                      {...register('admin_code')}/>
                  </div>
                )}
              </div>

              {serverError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-xl">{serverError}</div>
              )}

              <button type="submit" disabled={isSubmitting}
                className="w-full bg-dj-600 hover:bg-dj-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
                {isSubmitting ? 'Creando perfil...' : 'Crear perfil'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
