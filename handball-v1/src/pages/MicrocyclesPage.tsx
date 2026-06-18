import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, X, Save, FileDown, Share2,
  ChevronDown, ChevronUp, Copy, Check, Calendar,
} from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button, Toast } from '@/components/ui/index'
import {
  getOrCreateMacrocycle, updateMacrocycle,
  listDaysInMonth, listAllDays, listDaysInWeek,
  upsertMicrocycleDay, computeContentStats, getWeeksInMonth,
  addMomentToDay, removeMomentFromDay, updateMomentContent, updateMomentCategory,
  getOrCreateShareLink, buildShareUrl,
} from '@/lib/cycles'
import { downloadMicrocyclePDF } from '@/lib/pdfMicrocycle'
import type {
  Macrocycle, MicrocycleDay, MicrocycleMoment, TeamCategory, ContentCategory,
} from '@/types'

type Level = 'macro' | 'editor'

const WEEK_LABELS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']

const CONTENT_SHORT: Record<ContentCategory, string> = {
  'Técnica individual OFENSIVA':  'TÉC IND OF',
  'Técnica individual DEFENSIVA': 'TÉC IND DEF',
  'Táctica OFENSIVA':  'TAC OF',
  'Táctica DEFENSIVA': 'TAC DEF',
  'MIXTO': 'MIXTO',
}

const CONTENT_CATEGORIES: ContentCategory[] = [
  'Técnica individual OFENSIVA', 'Técnica individual DEFENSIVA',
  'Táctica OFENSIVA', 'Táctica DEFENSIVA', 'MIXTO',
]

const CONTENT_COLOR: Record<ContentCategory, string> = {
  'Técnica individual OFENSIVA':  'bg-dj-600 text-white',
  'Técnica individual DEFENSIVA': 'bg-blue-600 text-white',
  'Táctica OFENSIVA':  'bg-amber-500 text-white',
  'Táctica DEFENSIVA': 'bg-purple-600 text-white',
  'MIXTO': 'bg-gray-600 text-white',
}

export function MicrocyclesPage() {
  const { profile, selectedCategory } = useAppStore()
  const category = selectedCategory as TeamCategory

  const [level, setLevel] = useState<Level>('macro')
  const [macro, setMacro] = useState<Macrocycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [activeWeekStart, setActiveWeekStart] = useState<Date | null>(null)

  useEffect(() => {
    if (!profile || !category) return
    setLoading(true)
    getOrCreateMacrocycle(profile.id, category)
      .then(setMacro)
      .catch(() => setToast({ msg: 'Error al cargar el macrociclo.', type: 'error' }))
      .finally(() => setLoading(false))
  }, [profile, category])

  function openWeek(weekStart: Date) {
    setActiveWeekStart(weekStart)
    setLevel('editor')
  }

  if (loading) return <p className="text-sm text-gray-400 py-6">Cargando planificación anual...</p>
  if (!macro) return null

  return (
    <div className="space-y-4">
      {level === 'macro' && (
        <MacroView macro={macro} onUpdateMacro={setMacro} onOpenWeek={openWeek} onToast={setToast}/>
      )}
      {level === 'editor' && activeWeekStart && (
        <MicrocycleEditor
          macro={macro}
          weekStart={activeWeekStart}
          onBack={() => setLevel('macro')}
          onToast={setToast}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// VISTA MACROCICLO — objetivos, observaciones, radar, calendario de meses
// ════════════════════════════════════════════════════════════════════════════
function MacroView({ macro, onUpdateMacro, onOpenWeek, onToast }: {
  macro: Macrocycle
  onUpdateMacro: (m: Macrocycle) => void
  onOpenWeek: (weekStart: Date) => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
}) {
  const [showInfo, setShowInfo] = useState(false)
  const [annualObjective, setAnnualObjective] = useState(macro.annual_objective ?? '')
  const [annualObservations, setAnnualObservations] = useState(macro.annual_observations ?? '')
  const [saving, setSaving] = useState(false)

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [monthDays, setMonthDays] = useState<MicrocycleDay[]>([])
  const [allDays, setAllDays] = useState<MicrocycleDay[]>([])
  const [loadingMonth, setLoadingMonth] = useState(true)

  useEffect(() => {
    setLoadingMonth(true)
    listDaysInMonth(macro.id, currentMonth)
      .then(setMonthDays)
      .finally(() => setLoadingMonth(false))
  }, [macro.id, currentMonth])

  useEffect(() => {
    listAllDays(macro.id).then(setAllDays)
  }, [macro.id])

  const stats = useMemo(() => computeContentStats(allDays), [allDays])
  const radarData = CONTENT_CATEGORIES.map(c => ({ category: CONTENT_SHORT[c], value: stats[c] }))
  const hasAnyStats = Object.values(stats).some(v => v > 0)

  const weeks = useMemo(() => getWeeksInMonth(currentMonth), [currentMonth])

  function weekHasContent(weekStart: Date, weekEnd: Date) {
    return monthDays.some(d => {
      const date = new Date(d.date + 'T12:00:00')
      return date >= weekStart && date <= weekEnd && (d.day_label || d.moments.length > 0)
    })
  }

  async function handleSaveInfo() {
    setSaving(true)
    try {
      const updated = await updateMacrocycle(macro.id, {
        annual_objective: annualObjective,
        annual_observations: annualObservations,
      })
      onUpdateMacro(updated)
      onToast({ msg: 'Información anual guardada.', type: 'success' })
    } catch {
      onToast({ msg: 'Error al guardar.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">{macro.name}</h1>
        <p className="text-gray-500 text-sm mt-0.5">Planificación anual</p>
      </div>

      {/* ── Objetivos y Observaciones anuales ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
          onClick={() => setShowInfo(!showInfo)}
        >
          <span className="font-semibold text-gray-800 text-sm">Objetivos y observaciones anuales</span>
          {showInfo ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
        </button>
        {showInfo && (
          <div className="px-5 pb-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Objetivos anuales</label>
                <textarea
                  value={annualObjective}
                  onChange={e => setAnnualObjective(e.target.value)}
                  rows={4}
                  placeholder="Ej: Consolidar la base técnica individual y mejorar el rendimiento defensivo de cara al torneo provincial..."
                  className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-dj-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Observaciones</label>
                <textarea
                  value={annualObservations}
                  onChange={e => setAnnualObservations(e.target.value)}
                  rows={4}
                  placeholder="Notas generales de la temporada..."
                  className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-dj-400"
                />
              </div>
            </div>
            <Button size="sm" icon={<Save size={14}/>} loading={saving} onClick={handleSaveInfo}>
              Guardar
            </Button>
          </div>
        )}
      </div>

      {/* ── Gráfico de radar: contenidos más trabajados ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h3 className="font-semibold text-gray-800 text-sm mb-2">Contenidos más trabajados durante el año</h3>
        {!hasAnyStats ? (
          <p className="text-gray-400 text-sm text-center py-8">
            Todavía no hay contenidos categorizados en los microciclos. A medida que vayas completando semanas, este gráfico se va a llenar solo.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb"/>
                <PolarAngleAxis dataKey="category" tick={{ fill: '#374151', fontSize: 11, fontWeight: 600 }}/>
                <PolarRadiusAxis tick={{ fill: '#9ca3af', fontSize: 9 }}/>
                <Radar dataKey="value" stroke="#1e8a1e" fill="#1e8a1e" fillOpacity={0.35}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Calendario de meses (Mesociclo) con semanas (Microciclo) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 text-sm">Mesociclo (mes) y sus microciclos (semanas)</h3>
          <div className="flex items-center gap-2 bg-dj-800 rounded-xl px-3 py-1.5">
            <button onClick={() => setCurrentMonth(d => subMonths(d, 1))} className="text-white/60 hover:text-white">
              <ChevronLeft size={16}/>
            </button>
            <p className="text-white font-bold text-sm capitalize min-w-32 text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </p>
            <button onClick={() => setCurrentMonth(d => addMonths(d, 1))} className="text-white/60 hover:text-white">
              <ChevronRight size={16}/>
            </button>
          </div>
        </div>

        {loadingMonth ? (
          <p className="text-sm text-gray-400 py-4">Cargando...</p>
        ) : (
          <div className="space-y-2">
            {weeks.map(week => {
              const hasContent = weekHasContent(week.weekStart, week.weekEnd)
              return (
                <button
                  key={week.weekStart.toISOString()}
                  onClick={() => onOpenWeek(week.weekStart)}
                  className={clsx(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left',
                    hasContent
                      ? 'border-dj-300 bg-dj-50 hover:border-dj-500'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-300',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar size={15} className={hasContent ? 'text-dj-600' : 'text-gray-400'}/>
                    <span className="font-semibold text-gray-800 text-sm">{week.label}</span>
                  </div>
                  <span className={clsx(
                    'text-xs font-bold px-2.5 py-1 rounded-lg',
                    hasContent ? 'bg-dj-600 text-white' : 'text-gray-400',
                  )}>
                    {hasContent ? 'Con contenido' : 'Vacío'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// EDITOR DEL MICROCICLO (semana puntual, Lun-Dom)
// ════════════════════════════════════════════════════════════════════════════
function MicrocycleEditor({ macro, weekStart, onBack, onToast }: {
  macro: Macrocycle
  weekStart: Date
  onBack: () => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
}) {
  const [days, setDays] = useState<Record<string, MicrocycleDay | null>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showShare, setShowShare] = useState(false)

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
  const weekEnd = weekDates[6]

  useEffect(() => {
    setLoading(true)
    listDaysInWeek(macro.id, weekStart)
      .then(existing => {
        const map: Record<string, MicrocycleDay | null> = {}
        weekDates.forEach(d => {
          const key = format(d, 'yyyy-MM-dd')
          map[key] = existing.find(e => e.date === key) ?? null
        })
        setDays(map)
      })
      .catch(() => onToast({ msg: 'Error al cargar la semana.', type: 'error' }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macro.id, weekStart.getTime()])

  function getDay(dateKey: string): MicrocycleDay {
    return days[dateKey] ?? {
      id: '', macrocycle_id: macro.id, date: dateKey,
      day_label: null, rival_logo_url: null, moments: [],
      created_at: '', updated_at: '',
    }
  }

  function patchDay(dateKey: string, patch: Partial<MicrocycleDay>) {
    setDays(prev => ({ ...prev, [dateKey]: { ...getDay(dateKey), ...patch } }))
  }

  function handleAddMoment(dateKey: string) {
    const day = getDay(dateKey)
    patchDay(dateKey, { moments: addMomentToDay(day.moments, '') })
  }

  function handleRemoveMoment(dateKey: string, momentId: string) {
    const day = getDay(dateKey)
    patchDay(dateKey, { moments: removeMomentFromDay(day.moments, momentId) })
  }

  function handleMomentChange(dateKey: string, momentId: string, content: string) {
    const day = getDay(dateKey)
    patchDay(dateKey, { moments: updateMomentContent(day.moments, momentId, content) })
  }

  function handleMomentCategory(dateKey: string, momentId: string, category: ContentCategory | null) {
    const day = getDay(dateKey)
    patchDay(dateKey, { moments: updateMomentCategory(day.moments, momentId, category) })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const promises = Object.entries(days).map(([dateKey, day]) => {
        if (!day) return Promise.resolve()
        if (!day.day_label && day.moments.length === 0) return Promise.resolve()
        return upsertMicrocycleDay({
          macrocycle_id: macro.id,
          date: dateKey,
          day_label: day.day_label,
          rival_logo_url: day.rival_logo_url,
          moments: day.moments,
        })
      })
      await Promise.all(promises)
      onToast({ msg: 'Microciclo guardado.', type: 'success' })
    } catch {
      onToast({ msg: 'Error al guardar.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const orderedDays = weekDates.map(d => getDay(format(d, 'yyyy-MM-dd')))
      await downloadMicrocyclePDF({
        mesocycleNumber: weekStart.getMonth() + 1,
        microcycleNumber: Math.ceil(weekStart.getDate() / 7),
        weekStart,
        days: orderedDays,
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-6">Cargando microciclo...</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-dj-600">
          <ChevronLeft size={16}/> Volver al año
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Share2 size={15}/>} onClick={() => setShowShare(true)}>
            Compartir
          </Button>
          <Button variant="secondary" size="sm" icon={<FileDown size={15}/>} loading={exporting} onClick={handleExport}>
            PDF
          </Button>
          <Button size="sm" icon={<Save size={15}/>} loading={saving} onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </div>

      <div className="bg-dj-800 rounded-2xl px-5 py-3">
        <h2 className="text-white font-bold font-display text-lg">
          Microciclo semanal
        </h2>
        <p className="text-white/60 text-xs mt-0.5">
          {format(weekStart, "d 'de' MMMM", { locale: es })} – {format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {weekDates.map((date, i) => {
          const key = format(date, 'yyyy-MM-dd')
          const day = getDay(key)
          return (
            <DayColumn
              key={key}
              label={WEEK_LABELS[i]}
              date={date}
              day={day}
              onLabelChange={v => patchDay(key, { day_label: v })}
              onAddMoment={() => handleAddMoment(key)}
              onRemoveMoment={id => handleRemoveMoment(key, id)}
              onMomentChange={(id, v) => handleMomentChange(key, id, v)}
              onMomentCategory={(id, c) => handleMomentCategory(key, id, c)}
            />
          )
        })}
      </div>

      {showShare && (
        <ShareModal
          macrocycleId={macro.id}
          weekStart={weekStart}
          onClose={() => setShowShare(false)}
          onToast={onToast}
        />
      )}
    </div>
  )
}

function DayColumn({ label, date, day, onLabelChange, onAddMoment, onRemoveMoment, onMomentChange, onMomentCategory }: {
  label: string
  date: Date
  day: MicrocycleDay
  onLabelChange: (v: string) => void
  onAddMoment: () => void
  onRemoveMoment: (id: string) => void
  onMomentChange: (id: string, v: string) => void
  onMomentCategory: (id: string, c: ContentCategory | null) => void
}) {
  const sortedMoments = [...day.moments].sort((a, b) => a.order - b.order)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="bg-dj-700 text-center py-2">
        <p className="text-yellow-300 text-xs font-bold uppercase tracking-wide">{label}</p>
        <p className="text-white text-sm font-bold">{format(date, 'd/MM')}</p>
      </div>

      <div className="p-2">
        <input
          value={day.day_label ?? ''}
          onChange={e => onLabelChange(e.target.value)}
          placeholder="Ej: Sesión físico"
          className="w-full text-xs font-bold text-center rounded-xl px-2 py-2 mb-2 bg-amber-50 text-amber-800 focus:outline-none focus:ring-2 focus:ring-dj-400"
        />
      </div>

      <div className="flex-1 px-2 pb-2 space-y-1.5">
        {sortedMoments.map((m, i) => (
          <MomentBlock
            key={m.id}
            index={i}
            moment={m}
            onChange={v => onMomentChange(m.id, v)}
            onCategory={c => onMomentCategory(m.id, c)}
            onRemove={() => onRemoveMoment(m.id)}
          />
        ))}

        <button
          onClick={onAddMoment}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2 text-gray-300 hover:border-dj-300 hover:text-dj-500 transition-colors flex items-center justify-center"
        >
          <Plus size={15}/>
        </button>
      </div>
    </div>
  )
}

function MomentBlock({ index, moment, onChange, onCategory, onRemove }: {
  index: number
  moment: MicrocycleMoment
  onChange: (v: string) => void
  onCategory: (c: ContentCategory | null) => void
  onRemove: () => void
}) {
  const [showCatPicker, setShowCatPicker] = useState(false)
  const colorClass = moment.category ? CONTENT_COLOR[moment.category] : 'bg-dj-100 text-dj-900'

  return (
    <div className={clsx('rounded-xl px-2.5 py-2 group relative', colorClass)}>
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] font-bold mt-0.5 shrink-0 opacity-80">M{index + 1}:</span>
        <textarea
          value={moment.content}
          onChange={e => onChange(e.target.value)}
          placeholder="Contenido..."
          rows={2}
          className="flex-1 bg-transparent text-xs font-semibold resize-none focus:outline-none placeholder:opacity-50 placeholder:font-normal"
        />
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 hover:text-red-200 transition-opacity shrink-0"
        >
          <X size={12}/>
        </button>
      </div>

      <button
        onClick={() => setShowCatPicker(!showCatPicker)}
        className="text-[9px] font-bold mt-1 underline opacity-80 hover:opacity-100"
      >
        {moment.category ? CONTENT_SHORT[moment.category] : 'Elegir categoría'}
      </button>

      {showCatPicker && (
        <div className="absolute z-10 top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 p-1.5 w-44">
          {CONTENT_CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => { onCategory(c); setShowCatPicker(false) }}
              className={clsx('w-full text-left text-[10px] font-bold px-2 py-1.5 rounded-lg mb-0.5', CONTENT_COLOR[c])}
            >
              {CONTENT_SHORT[c]}
            </button>
          ))}
          <button
            onClick={() => { onCategory(null); setShowCatPicker(false) }}
            className="w-full text-left text-[10px] font-medium px-2 py-1.5 rounded-lg text-gray-400 hover:bg-gray-50"
          >
            Sin categoría
          </button>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL DE COMPARTIR (link público de solo lectura)
// ════════════════════════════════════════════════════════════════════════════
function ShareModal({ macrocycleId, weekStart, onClose, onToast }: {
  macrocycleId: string
  weekStart: Date
  onClose: () => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
}) {
  const { profile } = useAppStore()
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!profile) return
    getOrCreateShareLink(macrocycleId, format(weekStart, 'yyyy-MM-dd'), profile.id)
      .then(shared => setUrl(buildShareUrl(shared.token)))
      .catch(() => onToast({ msg: 'Error al generar el link.', type: 'error' }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCopy() {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Compartir microciclo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18}/>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-500">
            Cualquiera con este link puede ver esta semana, sin necesidad de iniciar sesión.
          </p>
          {loading ? (
            <p className="text-sm text-gray-400">Generando link...</p>
          ) : (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url ?? ''}
                className="flex-1 text-xs rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 text-gray-600"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 bg-dj-600 text-white rounded-xl px-3 py-2 hover:bg-dj-700 transition-colors"
              >
                {copied ? <Check size={15}/> : <Copy size={15}/>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
