import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, X } from 'lucide-react'
import { supabase, getProfile } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { Spinner } from '@/components/ui/index'
import type { Profile } from '@/types'

export function ProfilesPage() {
  const navigate = useNavigate()
  const { setProfile, account } = useAppStore()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!account) { navigate('/', { replace: true }); return }
    loadProfiles()
  }, [account])

  function loadProfiles() {
    if (!account) return
    supabase
      .from('profiles')
      .select('*')
      .eq('account_id', account.id)
      .order('full_name')
      .then(({ data }) => {
        setProfiles((data as Profile[]) ?? [])
        setLoading(false)
      })
  }

  async function handleSelectProfile(profile: Profile) {
    if (!account) return
    // El dominio interno y el prefijo de contraseña se derivan del access_code de la cuenta,
    // así cada cuenta nueva tiene su propio patrón automáticamente. Para Defensa y Justicia
    // (access_code = DYJHANDBALL2025) esto reproduce EXACTAMENTE el patrón ya existente
    // (@hbdj.internal / DYJ_..._2025), sin romper el acceso de ningún perfil ya creado.
    const isLegacyDyJ = account.access_code === 'DYJHANDBALL2025'
    const email = isLegacyDyJ
      ? `${profile.username.toLowerCase().trim()}@hbdj.internal`
      : `${profile.username.toLowerCase().trim()}@${account.access_code.toLowerCase()}.internal`
    const autoPassword = isLegacyDyJ
      ? `DYJ_${profile.username}_2025`
      : `${account.access_code}_${profile.username}`

    const { error } = await supabase.auth.signInWithPassword({ email, password: autoPassword })
    if (error) {
      alert('Error al ingresar. Contactá al administrador.')
      return
    }

    const { data: fullProfile } = await getProfile(profile.id)
    if (fullProfile) {
      setProfile(fullProfile)
      // Preparadores Físicos necesitan pasar por /categoria para vincular el coach
      if (fullProfile.role === 'preparador_fisico') {
        navigate('/categoria')
      } else {
        navigate('/menu')
      }
    }
  }

  async function handleConfirmDelete() {
    if (!deletingProfile) return
    setDeleting(true)
    const { error } = await supabase.rpc('delete_profile_public', { profile_id: deletingProfile.id })
    setDeleting(false)
    if (error) {
      alert('Error al eliminar el perfil. Intentá de nuevo.')
      return
    }
    setProfiles(prev => prev.filter(p => p.id !== deletingProfile.id))
    setDeletingProfile(null)
  }

  // Iniciales para el avatar
  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  const color = account?.primary_color || '#1e8a1e'

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${color}33 0%, ${color} 50%, ${color}cc 100%)` }}
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white">
            <ArrowLeft size={20}/>
          </button>
          <div>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest">{account?.name}</p>
            <h1 className="text-xl font-bold text-white font-display">¿Quién sos?</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={36}/></div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60 text-sm">No hay perfiles todavía.</p>
            <button
              onClick={() => navigate('/registro')}
              className="mt-4 text-white hover:text-white/80 text-sm font-medium underline"
            >
              Crear el primero
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {profiles.map(profile => (
              <div key={profile.id} className="relative group">
                <button
                  onClick={() => handleSelectProfile(profile)}
                  className="w-full flex flex-col items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white rounded-2xl p-5 text-center transition-all active:scale-[0.97]"
                >
                  {/* Avatar */}
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: profile.avatar_color ?? color }}
                  >
                    {getInitials(profile.full_name)}
                  </div>

                  {/* Nombre */}
                  <div>
                    <p className="font-semibold text-white text-sm leading-tight">
                      {profile.full_name}
                    </p>
                    {profile.categories?.length > 0 && (
                      <p className="text-white/50 text-xs mt-1 leading-tight">
                        {profile.categories.join(' · ')}
                      </p>
                    )}
                  </div>
                </button>

                {/* Botón de borrar — esquina superior derecha de la tarjeta */}
                <button
                  onClick={e => { e.stopPropagation(); setDeletingProfile(profile) }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/30 hover:bg-red-500 text-white/70 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  title="Eliminar perfil"
                >
                  <Trash2 size={13}/>
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-white/30 text-xs mt-8">
          Hacé clic en tu perfil para entrar
        </p>
      </div>

      {/* Modal de confirmación de borrado */}
      {deletingProfile && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setDeletingProfile(null) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Eliminar perfil</h3>
              <button onClick={() => setDeletingProfile(null)} className="text-gray-400 hover:text-gray-700">
                <X size={18}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                ¿Estás seguro de eliminar a <span className="font-bold text-gray-900">{deletingProfile.full_name}</span>?
                Esto también borrará todos sus entrenamientos guardados. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingProfile(null)}
                  className="flex-1 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-xl py-2.5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="flex-1 text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-xl py-2.5 transition-colors"
                >
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

