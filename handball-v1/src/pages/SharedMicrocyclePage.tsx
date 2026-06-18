import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Spinner } from '@/components/ui/index'
import { supabase } from '@/lib/supabase'
import { getSharedMicrocycleByToken, listDaysInWeek } from '@/lib/cycles'
import { CLUB_NAME } from '@/lib/constants'
import type { Macrocycle, MicrocycleDay, ContentCategory } from '@/types'

const WEEK_LABELS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']

const CONTENT_SHORT: Record<ContentCategory, string> = {
  'Técnica individual OFENSIVA':  'TÉC IND OF',
  'Técnica individual DEFENSIVA': 'TÉC IND DEF',
  'Táctica OFENSIVA':  'TAC OF',
  'Táctica DEFENSIVA': 'TAC DEF',
  'MIXTO': 'MIXTO',
}

const CONTENT_COLOR: Record<ContentCategory, string> = {
  'Técnica individual OFENSIVA':  'bg-dj-600 text-white',
  'Técnica individual DEFENSIVA': 'bg-blue-600 text-white',
  'Táctica OFENSIVA':  'bg-amber-500 text-white',
  'Táctica DEFENSIVA': 'bg-purple-600 text-white',
  'MIXTO': 'bg-gray-600 text-white',
}

export function SharedMicrocyclePage() {
  const { token } = useParams<{ token: string }>()
  const [macro, setMacro] = useState<Macrocycle | null>(null)
  const [days, setDays] = useState<MicrocycleDay[]>([])
  const [weekStart, setWeekStart] = useState<Date | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    getSharedMicrocycleByToken(token)
      .then(async shared => {
        const start = new Date(shared.week_start_date + 'T12:00:00')
        setWeekStart(start)

        const { data: macroData } = await supabase
          .from('macrocycles')
          .select('*')
          .eq('id', shared.macrocycle_id)
          .single()
        if (macroData) setMacro(macroData as Macrocycle)

        const weekDays = await listDaysInWeek(shared.macrocycle_id, start)
        setDays(weekDays)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dj-900">
        <Spinner size={36}/>
      </div>
    )
  }

  if (error || !weekStart) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dj-900 px-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
          <p className="text-gray-700 font-semibold">Este link no es válido o ya no está disponible.</p>
        </div>
      </div>
    )
  }

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  function getDay(date: Date): MicrocycleDay | null {
    const key = format(date, 'yyyy-MM-dd')
    return days.find(d => d.date === key) ?? null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-dj-800 rounded-2xl px-5 py-4 text-center">
          <p className="text-yellow-300 text-xs font-bold uppercase tracking-wide">{CLUB_NAME}</p>
          <h1 className="text-white font-bold font-display text-xl mt-1">
            {macro?.name}{macro?.team_category ? ` — ${macro.team_category}` : ''}
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Microciclo: {format(weekStart, "d 'de' MMMM", { locale: es })} – {format(weekDates[6], "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>

        {/* Grilla de días */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {weekDates.map((date, i) => {
            const day = getDay(date)
            const sortedMoments = day ? [...day.moments].sort((a, b) => a.order - b.order) : []
            const hasContent = day && (
              (day.labels?.length ?? 0) > 0 ||
              sortedMoments.length > 0 ||
              !!day.rival_logo_url
            )

            return (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                {/* Header del día */}
                <div className="bg-dj-700 text-center py-2">
                  <p className="text-yellow-300 text-xs font-bold uppercase tracking-wide">{WEEK_LABELS[i]}</p>
                  <p className="text-white text-sm font-bold">{format(date, 'd/MM')}</p>
                </div>

                <div className="p-2 flex-1 space-y-1.5">
                  {/* Imagen del día (escudo del rival, etc.) */}
                  {day?.rival_logo_url && (
                    <img
                      src={day.rival_logo_url}
                      alt="Imagen del día"
                      className="w-full h-16 object-contain rounded-xl bg-gray-50 border border-gray-100"
                    />
                  )}

                  {/* Chips de etiqueta libre */}
                  {(day?.labels?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {day!.labels.map((lbl, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-lg"
                        >
                          {lbl}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Momentos */}
                  {sortedMoments.map((m, idx) => (
                    <div
                      key={m.id}
                      className={`rounded-xl px-2.5 py-2 text-xs font-semibold ${m.category ? CONTENT_COLOR[m.category] : 'bg-dj-100 text-dj-900'}`}
                    >
                      <span className="opacity-80 font-bold">M{idx + 1}: </span>
                      {m.content || '—'}
                      {m.category && (
                        <p className="text-[9px] font-bold mt-1 opacity-80">{CONTENT_SHORT[m.category]}</p>
                      )}
                    </div>
                  ))}

                  {/* Día vacío */}
                  {!hasContent && (
                    <p className="text-gray-300 text-xs text-center py-6">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-center text-gray-400 text-xs pt-2">
          Planificación compartida desde la app de {CLUB_NAME}.
        </p>
      </div>
    </div>
  )
}
