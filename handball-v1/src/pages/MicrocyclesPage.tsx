import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft, ChevronRight, Plus, X, Save, FileDown, Share2,
  ChevronDown, ChevronUp, Copy, Check, Calendar, ImagePlus, Trash2,
} from 'lucide-react'
import { format, addMonths, subMonths, startOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts'
import { clsx } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { Button, Toast } from '@/components/ui/index'
import {
  getOrCreateMacrocycle, updateMacrocycle, listMacrocycles, createNewMacrocycle,
  listDaysInMonth, listAllDays, listDaysInWeek,
  upsertMicrocycleDay, computeContentStats, computeSubcontentStats, getWeeksInMonth, listDaysInWeek,
  addMomentToDay, removeMomentFromDay, updateMomentContent, updateMomentCategory, updateMomentSubcontent,
  getOrCreateShareLink, buildShareUrl, uploadDayImage, listTrainingMomentsForMacrocycle,
} from '@/lib/cycles'
import { listSubcontents, addSubcontent } from '@/lib/subcontents'
import { downloadMicrocyclePDF } from '@/lib/pdfMicrocycle'
import type {
  Macrocycle, MicrocycleDay, MicrocycleMoment, TeamCategory, ContentCategory, Subcontent,
} from '@/types'
import type { CountedMoment } from '@/lib/cycles'

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
  'Técnica individual OFENSIVA':  'bg-dj-700 text-white',
  'Táctica OFENSIVA':  'bg-dj-400 text-white',
  'Técnica individual DEFENSIVA': 'bg-blue-700 text-white',
  'Táctica DEFENSIVA': 'bg-blue-400 text-white',
  'MIXTO': 'bg-gray-600 text-white',
}

export function MicrocyclesPage() {
  const { profile, effectiveUserId, selectedCategory } = useAppStore()
  const category = selectedCategory as TeamCategory

  const [level, setLevel] = useState<Level>('macro')
  const [macro, setMacro] = useState<Macrocycle | null>(null)
  const [allMacros, setAllMacros] = useState<Macrocycle[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [activeWeekStart, setActiveWeekStart] = useState<Date | null>(null)

  useEffect(() => {
    if (!effectiveUserId || !category) return
    setLoading(true)
    getOrCreateMacrocycle(effectiveUserId!, category)
      .then(m => {
        setMacro(m)
        return listMacrocycles(effectiveUserId!, category)
      })
      .then(setAllMacros)
      .catch(() => setToast({ msg: 'Error al cargar el macrociclo.', type: 'error' }))
      .finally(() => setLoading(false))
  }, [effectiveUserId, category])

  function handleSelectMacro(m: Macrocycle) {
    setMacro(m)
  }

  async function handleCreateMacro(name: string, startDate: string) {
    if (!effectiveUserId) return
    try {
      const created = await createNewMacrocycle(effectiveUserId!, category, name, startDate)
      setAllMacros(prev => [created, ...prev].sort((a, b) => b.start_date.localeCompare(a.start_date)))
      setMacro(created)
      setToast({ msg: 'Nueva temporada creada.', type: 'success' })
    } catch {
      setToast({ msg: 'Error al crear la temporada.', type: 'error' })
    }
  }

  function openWeek(weekStart: Date) {
    setActiveWeekStart(weekStart)
    setLevel('editor')
  }

  if (loading) return <p className="text-sm text-gray-400 py-6">Cargando planificación anual...</p>
  if (!macro) return null

  return (
    <div className="space-y-4">
      {level === 'macro' && (
        <MacroView
          macro={macro}
          allMacros={allMacros}
          onSelectMacro={handleSelectMacro}
          onCreateMacro={handleCreateMacro}
          onUpdateMacro={setMacro}
          onOpenWeek={openWeek}
          onToast={setToast}
        />
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
// VISTA MACROCICLO
// ════════════════════════════════════════════════════════════════════════════
function MacroView({ macro, allMacros, onSelectMacro, onCreateMacro, onUpdateMacro, onOpenWeek, onToast }: {
  macro: Macrocycle
  allMacros: Macrocycle[]
  onSelectMacro: (m: Macrocycle) => void
  onCreateMacro: (name: string, startDate: string) => void
  onUpdateMacro: (m: Macrocycle) => void
  onOpenWeek: (weekStart: Date) => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
}) {
  const [showInfo, setShowInfo] = useState(false)
  const [showNewSeason, setShowNewSeason] = useState(false)
  const [newSeasonName, setNewSeasonName] = useState('')
  const [newSeasonDate, setNewSeasonDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [annualObjective, setAnnualObjective] = useState(macro.annual_objective ?? '')
  const [annualObservations, setAnnualObservations] = useState(macro.annual_observations ?? '')
  const [saving, setSaving] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [monthDays, setMonthDays] = useState<MicrocycleDay[]>([])
  const [allDays, setAllDays] = useState<MicrocycleDay[]>([])
  const [trainingMoments, setTrainingMoments] = useState<CountedMoment[]>([])
  const [loadingMonth, setLoadingMonth] = useState(true)
  const [subcontents, setSubcontents] = useState<Subcontent[]>([])
  const [pieCategory, setPieCategory] = useState<ContentCategory | ''>('')
  const [currentWeekEmpty, setCurrentWeekEmpty] = useState(false)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null)

  const { profile, effectiveUserId } = useAppStore()

  // Sincroniza los campos de texto cuando se cambia de temporada (macro)
  useEffect(() => {
    setAnnualObjective(macro.annual_objective ?? '')
    setAnnualObservations(macro.annual_observations ?? '')
  }, [macro.id])

  // Chequeo de la semana a avisar: si hoy es domingo, se adelanta a la semana que arranca mañana.
  // Cualquier otro día, chequea la semana actual. Independiente del mes navegado en el calendario.
  useEffect(() => {
    const today = new Date()
    const isSunday = today.getDay() === 0
    const baseWeekStart = startOfWeek(today, { weekStartsOn: 1 })
    const weekStart = isSunday ? addDays(baseWeekStart, 7) : baseWeekStart

    setCurrentWeekStart(weekStart)
    listDaysInWeek(macro.id, weekStart)
      .then(days => {
        const hasContent = days.some(d => d.labels.length > 0 || d.moments.length > 0 || !!d.rival_logo_url)
        setCurrentWeekEmpty(!hasContent)
      })
      .catch(() => {})
  }, [macro.id])

  useEffect(() => {
    setLoadingMonth(true)
    listDaysInMonth(macro.id, currentMonth)
      .then(setMonthDays)
      .finally(() => setLoadingMonth(false))
  }, [macro.id, currentMonth])

  useEffect(() => {
    listAllDays(macro.id).then(setAllDays)
  }, [macro.id])

  useEffect(() => {
    if (!effectiveUserId) return
    listTrainingMomentsForMacrocycle(effectiveUserId!)
      .then(setTrainingMoments)
      .catch(err => console.error('Error al cargar momentos de entrenamientos para estadísticas:', err))
    listSubcontents(effectiveUserId!)
      .then(setSubcontents)
      .catch(err => console.error('Error al cargar subcontenidos:', err))
  }, [effectiveUserId, macro.id])

  const stats = useMemo(
    () => computeContentStats(allDays, trainingMoments),
    [allDays, trainingMoments],
  )
  const radarData = CONTENT_CATEGORIES.map(c => ({ category: CONTENT_SHORT[c], value: stats[c] }))
  const hasAnyStats = Object.values(stats).some(v => v > 0)
  const weeks = useMemo(() => getWeeksInMonth(currentMonth), [currentMonth])

  const pieData = useMemo(() => {
    if (!pieCategory) return []
    const subStats = computeSubcontentStats(allDays, trainingMoments, pieCategory)
    return subStats.map(s => ({
      name: s.subcontent_id
        ? (subcontents.find(sc => sc.id === s.subcontent_id)?.label ?? 'Subcontenido eliminado')
        : 'Sin subcontenido',
      value: s.count,
    }))
  }, [pieCategory, allDays, trainingMoments, subcontents])

  const PIE_COLORS = ['#1e8a1e', '#1d4ed8', '#f59e0b', '#7c3aed', '#dc2626', '#0891b2', '#be185d', '#65a30d']

  function weekHasContent(weekStart: Date, weekEnd: Date) {
    return monthDays.some(d => {
      const date = new Date(d.date + 'T12:00:00')
      return date >= weekStart && date <= weekEnd && (d.labels.length > 0 || d.moments.length > 0)
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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-dj-600 text-xs font-bold uppercase tracking-wide mb-0.5">Macrociclo</p>
          <h1 className="text-2xl font-bold text-gray-900 font-display">{macro.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">Planificación anual</p>
        </div>
        <div className="flex items-center gap-2">
          {allMacros.length > 1 && (
            <select
              value={macro.id}
              onChange={e => {
                const selected = allMacros.find(m => m.id === e.target.value)
                if (selected) onSelectMacro(selected)
              }}
              className="text-sm rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-dj-400"
            >
              {allMacros.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          <Button variant="secondary" size="sm" icon={<Plus size={14}/>} onClick={() => setShowNewSeason(true)}>
            Nueva temporada
          </Button>
        </div>
      </div>

      {showNewSeason && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowNewSeason(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Nueva temporada</h3>
              <button onClick={() => setShowNewSeason(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18}/>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nombre</label>
                <input
                  value={newSeasonName}
                  onChange={e => setNewSeasonName(e.target.value)}
                  placeholder={`Ej: Temporada ${new Date().getFullYear() + 1}`}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Fecha de inicio</label>
                <input
                  type="date"
                  value={newSeasonDate}
                  onChange={e => setNewSeasonDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
                />
              </div>
              <Button
                className="w-full"
                disabled={!newSeasonName.trim()}
                onClick={() => {
                  onCreateMacro(newSeasonName.trim(), newSeasonDate)
                  setShowNewSeason(false)
                  setNewSeasonName('')
                }}
              >
                Crear temporada
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Banner: la semana actual (o entrante, si es domingo) todavía no tiene contenido cargado */}
      {currentWeekEmpty && currentWeekStart && (
        <button
          onClick={() => onOpenWeek(currentWeekStart)}
          className="w-full flex items-center gap-3 bg-amber-50 border-2 border-amber-200 hover:border-amber-300 rounded-2xl px-4 py-3 text-left transition-colors"
        >
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              {new Date().getDay() === 0 ? 'La semana que entra' : 'Esta semana'} ({format(currentWeekStart, 'd MMM', { locale: es })} – {format(addDays(currentWeekStart, 6), 'd MMM', { locale: es })}) todavía no tiene planificación cargada.
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Tocá para ir directo al microciclo y completarlo.</p>
          </div>
        </button>
      )}

      {/* Objetivos y Observaciones */}
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
                  placeholder="Ej: Consolidar la base técnica individual..."
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

      {/* Gráfico de radar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h3 className="font-semibold text-gray-800 text-sm mb-2">Contenidos más trabajados durante el año</h3>
        {!hasAnyStats ? (
          <p className="text-gray-400 text-sm text-center py-8">
            Todavía no hay contenidos categorizados. A medida que completes semanas, este gráfico se llena solo.
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

      {/* Gráfico de torta — desglose de subcontenidos por categoría */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-semibold text-gray-800 text-sm">Detalle de subcontenidos</h3>
          <select
            value={pieCategory}
            onChange={e => setPieCategory(e.target.value as ContentCategory | '')}
            className="text-sm rounded-xl border border-gray-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-dj-400"
          >
            <option value="">Elegí una categoría...</option>
            {CONTENT_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {!pieCategory ? (
          <p className="text-gray-400 text-sm text-center py-8">
            Elegí una categoría general arriba para ver el desglose de subcontenidos trabajados.
          </p>
        ) : pieData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">
            Todavía no hay Momentos categorizados como "{pieCategory}" con subcontenido asignado.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>
                  ))}
                </Pie>
                <Tooltip/>
                <Legend/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Calendario de meses con semanas */}
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
                    hasContent ? 'border-dj-300 bg-dj-50 hover:border-dj-500' : 'border-gray-100 bg-gray-50 hover:border-gray-300',
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
// EDITOR DEL MICROCICLO
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
  const [subcontents, setSubcontents] = useState<Subcontent[]>([])

  const { profile, effectiveUserId, account } = useAppStore()

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
  const weekEnd = weekDates[6]

  useEffect(() => {
    if (!effectiveUserId) return
    listSubcontents(effectiveUserId!).then(setSubcontents).catch(() => {})
  }, [effectiveUserId])

  async function handleAddSubcontent(category: ContentCategory, label: string) {
    if (!effectiveUserId) return
    const created = await addSubcontent(effectiveUserId!, category, label)
    setSubcontents(prev => [...prev, created])
    return created
  }

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
      labels: [], rival_logo_url: null, moments: [],
      created_at: '', updated_at: '',
    }
  }

  function patchDay(dateKey: string, patch: Partial<MicrocycleDay>) {
    setDays(prev => ({ ...prev, [dateKey]: { ...getDay(dateKey), ...patch } }))
  }

  function handleAddLabel(dateKey: string, label: string) {
    const day = getDay(dateKey)
    if (!label.trim()) return
    patchDay(dateKey, { labels: [...day.labels, label.trim()] })
  }

  function handleRemoveLabel(dateKey: string, idx: number) {
    const day = getDay(dateKey)
    patchDay(dateKey, { labels: day.labels.filter((_, i) => i !== idx) })
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

  function handleMomentSubcontent(dateKey: string, momentId: string, subcontentId: string | null) {
    const day = getDay(dateKey)
    patchDay(dateKey, { moments: updateMomentSubcontent(day.moments, momentId, subcontentId) })
  }

  async function handleImageUpload(dateKey: string, file: File) {
    try {
      const url = await uploadDayImage(file, macro.id, dateKey)
      patchDay(dateKey, { rival_logo_url: url })
      onToast({ msg: 'Imagen subida.', type: 'success' })
    } catch {
      onToast({ msg: 'Error al subir la imagen.', type: 'error' })
    }
  }

  function handleImageRemove(dateKey: string) {
    patchDay(dateKey, { rival_logo_url: null })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const promises = Object.entries(days).map(([dateKey, day]) => {
        if (!day) return Promise.resolve()
        const isEmpty = day.labels.length === 0 && day.moments.length === 0 && !day.rival_logo_url
        if (isEmpty) {
          // Si el día tiene ID (existe en Supabase) y quedó vacío, lo borramos
          if (day.id) {
            return supabase.from('microcycle_days').delete().eq('id', day.id)
          }
          return Promise.resolve()
        }
        return upsertMicrocycleDay({
          macrocycle_id: macro.id,
          date: dateKey,
          labels: day.labels,
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
        subcontents,
        account,
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
        <h2 className="text-white font-bold font-display text-lg">Microciclo semanal</h2>
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
              onAddLabel={label => handleAddLabel(key, label)}
              onRemoveLabel={idx => handleRemoveLabel(key, idx)}
              onAddMoment={() => handleAddMoment(key)}
              onRemoveMoment={id => handleRemoveMoment(key, id)}
              onMomentChange={(id, v) => handleMomentChange(key, id, v)}
              onMomentCategory={(id, c) => handleMomentCategory(key, id, c)}
              onMomentSubcontent={(id, s) => handleMomentSubcontent(key, id, s)}
              subcontents={subcontents}
              onAddSubcontent={handleAddSubcontent}
              onImageUpload={file => handleImageUpload(key, file)}
              onImageRemove={() => handleImageRemove(key)}
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

// ════════════════════════════════════════════════════════════════════════════
// COLUMNA DEL DÍA
// ════════════════════════════════════════════════════════════════════════════
function DayColumn({ label, date, day, onAddLabel, onRemoveLabel, onAddMoment, onRemoveMoment, onMomentChange, onMomentCategory, onMomentSubcontent, subcontents, onAddSubcontent, onImageUpload, onImageRemove }: {
  label: string
  date: Date
  day: MicrocycleDay
  onAddLabel: (v: string) => void
  onRemoveLabel: (idx: number) => void
  onAddMoment: () => void
  onRemoveMoment: (id: string) => void
  onMomentChange: (id: string, v: string) => void
  onMomentCategory: (id: string, c: ContentCategory | null) => void
  onMomentSubcontent: (id: string, s: string | null) => void
  subcontents: Subcontent[]
  onAddSubcontent: (category: ContentCategory, label: string) => Promise<Subcontent | undefined>
  onImageUpload: (file: File) => void
  onImageRemove: () => void
}) {
  const [newLabel, setNewLabel] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const sortedMoments = [...day.moments].sort((a, b) => a.order - b.order)

  function handleLabelKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && newLabel.trim()) {
      onAddLabel(newLabel)
      setNewLabel('')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Header del día */}
      <div className="bg-dj-700 text-center py-2">
        <p className="text-yellow-300 text-xs font-bold uppercase tracking-wide">{label}</p>
        <p className="text-white text-sm font-bold">{format(date, 'd/MM')}</p>
      </div>

      <div className="p-2 flex-1 flex flex-col gap-2">
        {/* Imagen del día */}
        {day.rival_logo_url ? (
          <div className="relative group">
            <img
              src={day.rival_logo_url}
              alt="Imagen del día"
              className="w-full h-16 object-contain rounded-xl bg-gray-50 border border-gray-100"
            />
            <button
              onClick={() => { onImageRemove(); setFileInputKey(k => k + 1) }}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10}/>
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2 text-gray-300 hover:border-dj-300 hover:text-dj-500 transition-colors flex items-center justify-center gap-1"
          >
            <ImagePlus size={14}/> <span className="text-[10px] font-medium">Imagen</span>
          </button>
        )}
        <input
          key={fileInputKey}
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onImageUpload(f) }}
        />

        {/* Chips de etiqueta */}
        <div className="flex flex-wrap gap-1">
          {day.labels.map((lbl, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-lg"
            >
              {lbl}
              <button onClick={() => onRemoveLabel(idx)} className="hover:text-red-500">
                <X size={9}/>
              </button>
            </span>
          ))}
        </div>

        {/* Input para nuevo chip */}
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={handleLabelKeyDown}
          onBlur={() => { if (newLabel.trim()) { onAddLabel(newLabel); setNewLabel('') } }}
          placeholder="+ Etiqueta (Enter)"
          className="w-full text-[10px] rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-dj-400 placeholder:text-gray-300"
        />

        {/* Separador */}
        <div className="border-t border-gray-100"/>

        {/* Momentos */}
        <div className="space-y-1.5">
          {sortedMoments.map((m, i) => (
            <MomentBlock
              key={m.id}
              index={i}
              moment={m}
              onChange={v => onMomentChange(m.id, v)}
              onCategory={c => onMomentCategory(m.id, c)}
              onSubcontent={s => onMomentSubcontent(m.id, s)}
              subcontents={subcontents}
              onAddSubcontent={onAddSubcontent}
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
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// BLOQUE DE MOMENTO
// ════════════════════════════════════════════════════════════════════════════
function MomentBlock({ index, moment, onChange, onCategory, onSubcontent, subcontents, onAddSubcontent, onRemove }: {
  index: number
  moment: MicrocycleMoment
  onChange: (v: string) => void
  onCategory: (c: ContentCategory | null) => void
  onSubcontent: (s: string | null) => void
  subcontents: Subcontent[]
  onAddSubcontent: (category: ContentCategory, label: string) => Promise<Subcontent | undefined>
  onRemove: () => void
}) {
  const [showCatPicker, setShowCatPicker] = useState(false)
  const [newSubLabel, setNewSubLabel] = useState('')
  const [addingSub, setAddingSub] = useState(false)
  const colorClass = moment.category ? CONTENT_COLOR[moment.category] : 'bg-dj-100 text-dj-900'

  const subOptions = moment.category ? subcontents.filter(s => s.category === moment.category) : []
  const currentSub = subcontents.find(s => s.id === moment.subcontent_id)

  async function handleCreateSub() {
    if (!moment.category || !newSubLabel.trim()) return
    setAddingSub(true)
    const created = await onAddSubcontent(moment.category, newSubLabel.trim())
    setAddingSub(false)
    setNewSubLabel('')
    if (created) onSubcontent(created.id)
  }

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
        onClick={() => setShowCatPicker(true)}
        className="text-[9px] font-bold mt-1 underline opacity-80 hover:opacity-100"
      >
        {moment.category ? CONTENT_SHORT[moment.category] : 'Elegir categoría'}
        {currentSub ? ` · ${currentSub.label}` : ''}
      </button>

      {showCatPicker && createPortal(
        <div
          className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCatPicker(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-900 text-sm">Categoría y subcontenido</h3>
              <button onClick={() => setShowCatPicker(false)} className="text-gray-400 hover:text-gray-700">
                <X size={16}/>
              </button>
            </div>

            <div className="p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Categoría general</p>
              <div className="space-y-1 mb-3">
                {CONTENT_CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => onCategory(c)}
                    className={clsx(
                      'w-full text-left text-xs font-bold px-3 py-2 rounded-xl',
                      CONTENT_COLOR[c],
                      moment.category === c ? 'ring-2 ring-offset-1 ring-gray-300' : '',
                    )}
                  >
                    {CONTENT_SHORT[c]}
                  </button>
                ))}
                <button
                  onClick={() => { onCategory(null); setShowCatPicker(false) }}
                  className="w-full text-left text-xs font-medium px-3 py-2 rounded-xl text-gray-400 hover:bg-gray-50"
                >
                  Sin categoría
                </button>
              </div>

              {moment.category && (
                <>
                  <div className="border-t border-gray-100 my-3"/>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Subcontenido</p>
                  <div className="space-y-1 mb-3">
                    {subOptions.length === 0 && (
                      <p className="text-xs text-gray-300 px-1 py-1">Sin subcontenidos todavía.</p>
                    )}
                    {subOptions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => onSubcontent(s.id)}
                        className={clsx(
                          'w-full text-left text-xs px-3 py-2 rounded-xl',
                          moment.subcontent_id === s.id ? 'bg-gray-100 font-bold text-gray-800' : 'text-gray-600 hover:bg-gray-50',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newSubLabel}
                      onChange={e => setNewSubLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateSub()}
                      placeholder="Nuevo subcontenido..."
                      className="flex-1 text-xs rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-dj-400"
                    />
                    <button
                      onClick={handleCreateSub}
                      disabled={addingSub || !newSubLabel.trim()}
                      className="shrink-0 bg-dj-600 text-white rounded-xl px-3 disabled:opacity-40"
                    >
                      <Plus size={14}/>
                    </button>
                  </div>
                </>
              )}

              <Button className="w-full mt-4" onClick={() => setShowCatPicker(false)}>
                Listo
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL DE COMPARTIR
// ════════════════════════════════════════════════════════════════════════════
function ShareModal({ macrocycleId, weekStart, onClose, onToast }: {
  macrocycleId: string
  weekStart: Date
  onClose: () => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
}) {
  const { profile, effectiveUserId } = useAppStore()
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!effectiveUserId) return
    getOrCreateShareLink(macrocycleId, format(weekStart, 'yyyy-MM-dd'), effectiveUserId!)
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Compartir microciclo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-500">Cualquiera con este link puede ver esta semana sin iniciar sesión.</p>
          {loading ? (
            <p className="text-sm text-gray-400">Generando link...</p>
          ) : (
            <div className="flex items-center gap-2">
              <input readOnly value={url ?? ''} className="flex-1 text-xs rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 text-gray-600"/>
              <button onClick={handleCopy} className="shrink-0 bg-dj-600 text-white rounded-xl px-3 py-2 hover:bg-dj-700 transition-colors">
                {copied ? <Check size={15}/> : <Copy size={15}/>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
