import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { createAccountRequest, isAccessCodeAvailable } from '@/lib/accounts'
import { uploadImage } from '@/lib/supabase'
import { extractDominantColors } from '@/lib/colorExtract'

const COLOR_OPTIONS = [
  '#1e8a1e', '#166f16', '#3da83d',
  '#1d4ed8', '#0ea5e9', '#0f766e',
  '#7c3aed', '#9333ea', '#be185d', '#db2777',
  '#b45309', '#d97706', '#c2410c',
  '#dc2626', '#ef4444',
  '#475569', '#1e293b',
]

export function CreateAccountComingSoonPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clubName, setClubName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPrev, setLogoPrev] = useState<string | null>(null)
  const [detectedColors, setDetectedColors] = useState<string[]>([])
  const [extractingColors, setExtractingColors] = useState(false)

  const [adminName, setAdminName] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setLogoFile(f)
    setLogoPrev(URL.createObjectURL(f))
    setExtractingColors(true)
    try {
      const colors = await extractDominantColors(f, 4)
      setDetectedColors(colors)
      if (colors.length > 0) setColor(colors[0])
    } finally {
      setExtractingColors(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!clubName.trim() || !accessCode.trim() || !adminName.trim() || !adminUsername.trim() || !adminPassword.trim()) {
      setError('Completá todos los campos obligatorios.')
      return
    }
    if (adminPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const available = await isAccessCodeAvailable(accessCode)
      if (!available) {
        setError('Ese código de acceso ya está en uso. Probá con otro.')
        setSubmitting(false)
        return
      }

      let logo_url: string | null = null
      if (logoFile) {
        const { url } = await uploadImage('exercises', logoFile)
        logo_url = url
      }

      const { error: reqError } = await createAccountRequest({
        name: clubName,
        access_code: accessCode,
        primary_color: color,
        logo_url,
        admin_full_name: adminName,
        admin_username: adminUsername,
        admin_password: adminPassword,
      })

      if (reqError) {
        setError('Ocurrió un error al enviar la solicitud. Probá de nuevo en unos minutos.')
        setSubmitting(false)
        return
      }

      setStep('success')
    } catch {
      setError('Ocurrió un error al enviar la solicitud. Probá de nuevo en unos minutos.')
      setSubmitting(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-6">
            <CheckCircle2 size={28} className="text-emerald-400"/>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Solicitud enviada</h1>
          <p className="text-gray-400 text-sm mb-8">
            Tu solicitud fue enviada. Te vamos a contactar pronto para activarla.
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
          >
            <ArrowLeft size={15}/> Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="text-white/60 hover:text-white">
            <ArrowLeft size={20}/>
          </button>
          <h1 className="text-xl font-bold text-white">Crear tu cuenta en HandPlan</h1>
        </div>

        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl shadow-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className="text-xs font-bold text-white/70 uppercase tracking-wide mb-3">Tu club</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Nombre del club o equipo</label>
                  <input
                    value={clubName}
                    onChange={e => setClubName(e.target.value)}
                    placeholder="Ej: Club Atlético Ejemplo"
                    className="w-full rounded-xl border border-gray-700 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Código de acceso deseado</label>
                  <input
                    value={accessCode}
                    onChange={e => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="Ej: CLUBEJEMPLO2026"
                    className="w-full rounded-xl border border-gray-700 bg-black/40 px-3 py-2.5 text-sm text-white font-mono uppercase placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Es el código que van a usar tus entrenadores para entrar.</p>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">Logo (opcional)</label>
                  {logoPrev ? (
                    <div className="flex items-center gap-3">
                      <img src={logoPrev} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-700"/>
                      <button type="button" onClick={() => { setLogoFile(null); setLogoPrev(null); setDetectedColors([]) }} className="text-xs text-red-400 hover:text-red-300">
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer inline-flex items-center gap-2 border border-dashed border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-400 hover:border-emerald-500 hover:text-emerald-400 transition-colors">
                      <Upload size={15}/> Subir logo
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange}/>
                    </label>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Si no subís uno, se usa el logo de HandPlan mientras tanto.</p>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">Color principal</label>
                  {(extractingColors || detectedColors.length > 0) && (
                    <div className="mb-3">
                      <p className="text-xs text-emerald-400 flex items-center gap-1.5 mb-2">
                        <Sparkles size={12}/>
                        {extractingColors ? 'Analizando colores del logo...' : 'Detectados en tu logo'}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {extractingColors ? (
                          <Loader2 size={20} className="animate-spin text-gray-500"/>
                        ) : (
                          detectedColors.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setColor(c)}
                              className="w-9 h-9 rounded-full border-2 transition-transform"
                              style={{ backgroundColor: c, borderColor: color === c ? '#fff' : 'transparent', transform: color === c ? 'scale(1.15)' : 'scale(1)' }}
                              title={c}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mb-2">{detectedColors.length > 0 ? 'O elegí uno de la paleta' : 'Paleta'}</p>
                  <div className="flex gap-2 flex-wrap">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className="w-8 h-8 rounded-full border-2 transition-transform"
                        style={{ backgroundColor: c, borderColor: color === c ? '#fff' : 'transparent', transform: color === c ? 'scale(1.15)' : 'scale(1)' }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-5">
              <p className="text-xs font-bold text-white/70 uppercase tracking-wide mb-3">Tu perfil de administrador</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Nombre completo</label>
                  <input
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full rounded-xl border border-gray-700 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Nombre de usuario</label>
                  <input
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value.replace(/\s+/g, '_'))}
                    placeholder="Ej: juan_perez"
                    className="w-full rounded-xl border border-gray-700 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-xl border border-gray-700 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin"/> : null}
              Enviar solicitud
            </button>
            <p className="text-xs text-gray-500 text-center">
              Tu cuenta queda pendiente de aprobación. Te vamos a contactar para activarla.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
