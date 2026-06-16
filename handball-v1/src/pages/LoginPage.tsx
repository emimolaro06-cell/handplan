import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { signInWithUsername, getProfile } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/index'
import { CLUB_NAME } from '@/lib/constants'

interface Form { username: string; password: string }

export function LoginPage() {
  const navigate = useNavigate()
  const setProfile = useAppStore(s => s.setProfile)
  const [showPass, setShowPass] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>()

  async function onSubmit({ username, password }: Form) {
    setServerError(null)
    const { data, error } = await signInWithUsername(username, password)
    if (error || !data.user) {
      setServerError('Usuario o contraseña incorrectos.')
      return
    }
    const { data: profile, error: pErr } = await getProfile(data.user.id)
    if (pErr || !profile) {
      setServerError('Perfil no encontrado. Contactá al administrador.')
      return
    }
    setProfile(profile)
    navigate('/categoria')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #072d07 0%, #1e8a1e 50%, #0d420d 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Escudo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-400/20 border-2 border-gold-400/40 mb-4">
            <img src="/logo.svg" alt="Logo" className="w-16 h-16"/>
          </div>
          <h1 className="text-2xl font-bold text-white font-display tracking-wide">
            {CLUB_NAME}
          </h1>
          <p className="text-white/50 text-sm mt-1">Planificador de Entrenamientos</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Franja verde superior */}
          <div className="h-1.5 bg-gradient-to-r from-dj-700 via-gold-400 to-dj-700"/>

          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Iniciar sesión</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Usuario */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Usuario</label>
                <input
                  type="text"
                  placeholder="Tu nombre de usuario"
                  autoComplete="username"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-dj-400 hover:border-gray-300 transition-colors"
                  {...register('username', { required: 'Ingresá tu usuario' })}
                />
                {errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}
              </div>

              {/* Contraseña */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-dj-400 hover:border-gray-300 transition-colors"
                    {...register('password', { required: 'Ingresá tu contraseña' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
              </div>

              {serverError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-xl">
                  {serverError}
                </div>
              )}

              <Button
                type="submit"
                loading={isSubmitting}
                className="w-full mt-1"
                size="lg"
                icon={<LogIn size={16}/>}
              >
                Ingresar
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          ¿Sin acceso? Contactá al administrador del club.
        </p>
      </div>
    </div>
  )
}
