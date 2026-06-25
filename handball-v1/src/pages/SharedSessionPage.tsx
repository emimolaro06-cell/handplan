import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileDown } from 'lucide-react'
import { getSharedSession, supabase } from '@/lib/supabase'
import { downloadTrainingPDF } from '@/lib/pdf'
import { Spinner } from '@/components/ui/index'
import { CLUB_NAME } from '@/lib/constants'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { TrainingSession, Account } from '@/types'

export function SharedSessionPage() {
  const { token } = useParams<{ token: string }>()
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!token) { setError(true); setLoading(false); return }
    getSharedSession(token).then(async ({ data, error: err }) => {
      if (err || !data) { setError(true); setLoading(false); return }
      const s = data as TrainingSession
      setSession(s)
      // Identidad de la cuenta del coach dueño de este entrenamiento, para una vista
      // pública sin login que igual respete los colores/logo del club correspondiente.
      const { data: profile } = await supabase
        .from('profiles').select('account_id').eq('id', s.user_id).maybeSingle()
      if (profile?.account_id) {
        const { data: acc } = await supabase
          .from('accounts').select('*').eq('id', profile.account_id).maybeSingle()
        if (acc) setAccount(acc as Account)
      }
      setLoading(false)
    })
  }, [token])

  const color = account?.primary_color || '#1e8a1e'
  const accountName = account?.name || CLUB_NAME
  const logoUrl = account?.logo_url || '/logo-handplan.svg'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: color }}>
      <Spinner size={36}/>
    </div>
  )

  if (error || !session) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: color }}>
      <div className="text-center">
        <p className="text-white font-bold text-lg mb-2">Enlace no válido</p>
        <p className="text-white/50 text-sm">Este entrenamiento no existe o el enlace expiró.</p>
      </div>
    </div>
  )

  const sorted = [...session.moments].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="px-6 py-5" style={{ backgroundColor: color }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <img src={logoUrl} alt={accountName} className="w-10 h-10 object-contain"/>
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest">{accountName}</p>
          </div>
          <h1 className="text-2xl font-bold text-white font-display">
            Sesión {session.session_number} — {session.team_category}
          </h1>
          <p className="text-white/60 text-sm mt-1">
            {format(new Date(session.session_date), "d 'de' MMMM yyyy", { locale: es })} · {session.coach_name} · {session.total_duration_min} min
          </p>
          <button
            onClick={() => downloadTrainingPDF(session, account)}
            className="mt-4 inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-bold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            <FileDown size={16}/> Descargar PDF
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Info general */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3">Datos generales</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Categoría', session.team_category],
              ['Contenido', session.content_category],
              ['Duración', `${session.total_duration_min} min`],
              ['Momentos', String(session.moments.length)],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-gray-500">{k}</p>
                <p className="font-medium text-gray-900">{v}</p>
              </div>
            ))}
          </div>
          {session.general_objective && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Objetivo general</p>
              <p className="text-sm text-gray-800">{session.general_objective}</p>
            </div>
          )}
        </div>

        {/* Momentos */}
        <h2 className="font-bold text-gray-900">Momentos</h2>
        {sorted.map((m, i) => (
          <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: color }}>
              <div className="w-7 h-7 rounded-lg bg-white text-gray-900 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </div>
              <p className="text-white font-semibold text-sm">
                {m.exercise_label || m.exercise_category} · {m.duration_min} min
              </p>
            </div>
            <div className="flex gap-4 p-4">
              {m.image_url && (
                <img src={m.image_url} alt="" className="w-48 h-36 object-cover rounded-xl flex-shrink-0"/>
              )}
              <div className="flex-1 min-w-0">
                {m.description && <p className="text-sm text-gray-800 mb-2">{m.description}</p>}
                {m.observations && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Observaciones</p>
                    <p className="text-sm text-gray-700">{m.observations}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

