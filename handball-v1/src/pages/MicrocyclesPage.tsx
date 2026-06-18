import { useState, useEffect } from 'react'
import {
  ChevronLeft, Plus, X, Trash2, Calendar, FileDown,
  Save, GripVertical, Shield, ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import { format, addWeeks, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button, Toast } from '@/components/ui/index'
import {
  listMacrocycles, createMacrocycle, deleteMacrocycle,
  listMesocycles, createMesocycle, deleteMesocycle,
  listMicrocycles, createMicrocycle, deleteMicrocycle,
  listMicrocycleDays, upsertMicrocycleDay,
  addMomentToDay, removeMomentFromDay, updateMomentContent,
} from '@/lib/cycles'
import { downloadMicrocyclePDF } from '@/lib/pdfMicrocycle'
import type {
  Macrocycle, Mesocycle, Microcycle, MicrocycleDay, MicrocycleMoment, TeamCategory,
} from '@/types'

type Level = 'macro' | 'meso' | 'micro' | 'editor'

const WEEK_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function MicrocyclesPage() {
  const { profile, selectedCategory } = useAppStore()
  const category = selectedCategory as TeamCategory

  const [level, setLevel] = useState<Level>('macro')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [macros, setMacros] = useState<Macrocycle[]>([])
  const [activeMacro, setActiveMacro] = useState<Macrocycle | null>(null)

  const [mesos, setMesos] = useState<Mesocycle[]>([])
  const [activeMeso, setActiveMeso] = useState<Mesocycle | null>(null)

  const [micros, setMicros] = useState<Microcycle[]>([])
  const [activeMicro, setActiveMicro] = useState<Microcycle | null>(null)

  const [loading, setLoading] = useState(false)

  // ── Carga de Macrociclos ──
  useEffect(() => {
    if (!profile || !category) return
    setLoading(true)
    listMacrocycles(profile.id, category)
      .then(setMacros)
      .catch(() => setToast({ msg: 'Error al cargar macrociclos.', type: 'error' }))
      .finally(() => setLoading(false))
  }, [profile, category])

  function openMacro(m: Macrocycle) {
    setActiveMacro(m)
    setLoading(true)
    listMesocycles(m.id)
      .then(data => { setMesos(data); setLevel('meso') })
      .catch(() => setToast({ msg: 'Error al cargar mesociclos.', type: 'error' }))
      .finally(() => setLoading(false))
  }

  function openMeso(m: Mesocycle) {
    setActiveMeso(m)
    setLoading(true)
    listMicrocycles(m.id)
      .then(data => { setMicros(data); setLevel('micro') })
      .catch(() => setToast({ msg: 'Error al cargar microciclos.', type: 'error' }))
      .finally(() => setLoading(false))
  }

  function openMicro(m: Microcycle) {
    setActiveMicro(m)
    setLevel('editor')
  }

  async function handleCreateMacro(name: string, startDate: string) {
    if (!profile) return
    try {
      const created = await createMacrocycle({
        user_id: profile.id, team_category: category, name, start_date: startDate,
      })
      setMacros(prev => [created, ...prev])
      setToast({ msg: 'Macrociclo creado.', type: 'success' })
    } catch {
      setToast({ msg: 'Error al crear el macrociclo.', type: 'error' })
    }
  }

  async function handleCreateMeso(name: string, objective: string) {
    if (!activeMacro) return
    try {
      const created = await createMesocycle({ macrocycle_id: activeMacro.id, name, objective })
      setMesos(prev => [...prev, created].sort((a, b) => a.number - b.number))
      setToast({ msg: 'Mesociclo creado.', type: 'success' })
    } catch {
      setToast({ msg: 'Error al crear el mesociclo.', type: 'error' })
    }
  }

  async function handleCreateMicro() {
    if (!activeMeso) return
    try {
      // Próxima semana disponible: si hay microciclos previos, continúa después del último.
      let weekStart: Date
      if (micros.length > 0) {
        const last = micros[micros.length - 1]
        weekStart = addWeeks(new Date(last.week_start_date + 'T12:00:00'), 1)
      } else {
        weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
      }
      const created = await createMicrocycle({
        mesocycle_id: activeMeso.id,
        week_start_date: format(weekStart, 'yyyy-MM-dd'),
      })
      setMicros(prev => [...prev, created].sort((a, b) => a.number - b.number))
      setToast({ msg: 'Microciclo creado.', type: 'success' })
    } catch {
      setToast({ msg: 'Error al crear el microciclo.', type: 'error' })
    }
  }

  async function handleDeleteMacro(id: string) {
    try {
      await deleteMacrocycle(id)
      setMacros(prev => prev.filter(m => m.id !== id))
      setToast({ msg: 'Macrociclo eliminado.', type: 'success' })
    } catch {
      setToast({ msg: 'Error al eliminar.', type: 'error' })
    }
  }

  async function handleDeleteMeso(id: string) {
    try {
      await deleteMesocycle(id)
      setMesos(prev => prev.filter(m => m.id !== id))
      setToast({ msg: 'Mesociclo eliminado.', type: 'success' })
    } catch {
      setToast({ msg: 'Error al eliminar.', type: 'error' })
    }
  }

  async function handleDeleteMicro(id: string) {
    try {
      await deleteMicrocycle(id)
      setMicros(prev => prev.filter(m => m.id !== id))
      setToast({ msg: 'Microciclo eliminado.', type: 'success' })
    } catch {
      setToast({ msg: 'Error al eliminar.', type: 'error' })
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Breadcrumb de navegación
  // ════════════════════════════════════════════════════════════════════════
  function Breadcrumb() {
    return (
      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        <button
          onClick={() => setLevel('macro')}
          className={clsx('font-semibold', level === 'macro' ? 'text-dj-700' : 'text-gray-400 hover:text-dj-600')}
        >
          Macrociclos
        </button>
        {activeMacro && (
          <>
            <ChevronRightIcon size={14} className="text-gray-300"/>
            <button
              onClick={() => setLevel('meso')}
              className={clsx('font-semibold', level === 'meso' ? 'text-dj-700' : 'text-gray-400 hover:text-dj-600')}
            >
              {activeMacro.name}
            </button>
          </>
        )}
        {activeMeso && (
          <>
            <ChevronRightIcon size={14} className="text-gray-300"/>
            <button
              onClick={() => setLevel('micro')}
              className={clsx('font-semibold', level === 'micro' ? 'text-dj-700' : 'text-gray-400 hover:text-dj-600')}
            >
              Mesociclo {activeMeso.number}
            </button>
          </>
        )}
        {activeMicro && level === 'editor' && (
          <>
            <ChevronRightIcon size={14} className="text-gray-300"/>
            <span className="font-semibold text-dj-700">Microciclo {activeMicro.number}</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8">
      <Breadcrumb/>

      {level === 'macro' && (
        <MacroList
          macros={macros}
          loading={loading}
          onOpen={openMacro}
          onCreate={handleCreateMacro}
          onDelete={handleDeleteMacro}
        />
      )}

      {level === 'meso' && activeMacro && (
        <MesoList
          macro={activeMacro}
          mesos={mesos}
          loading={loading}
          onBack={() => setLevel('macro')}
          onOpen={openMeso}
          onCreate={handleCreateMeso}
          onDelete={handleDeleteMeso}
        />
      )}

      {level === 'micro' && activeMeso && (
        <MicroList
          meso={activeMeso}
          micros={micros}
          loading={loading}
          onBack={() => setLevel('meso')}
          onOpen={openMicro}
          onCreate={handleCreateMicro}
          onDelete={handleDeleteMicro}
        />
      )}

      {level === 'editor' && activeMicro && activeMeso && (
        <MicrocycleEditor
          microcycle={activeMicro}
          mesocycle={activeMeso}
          onBack={() => setLevel('micro')}
          onToast={setToast}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// NIVEL 1 — Lista de Macrociclos
// ════════════════════════════════════════════════════════════════════════════
function MacroList({ macros, loading, onOpen, onCreate, onDelete }: {
  macros: Macrocycle[]
  loading: boolean
  onOpen: (m: Macrocycle) => void
  onCreate: (name: string, startDate: string) => void
  onDelete: (id: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 font-display">Macrociclos (temporadas)</h2>
        <Button size="sm" icon={<Plus size={15}/>} onClick={() => setShowForm(true)}>
          Nuevo macrociclo
        </Button>
      </div>

      {loading && <p className="text-sm text-gray-400">Cargando...</p>}

      {!loading && macros.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-sm">Todavía no hay macrociclos para esta categoría.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {macros.map(m => (
          <div
            key={m.id}
            onClick={() => onOpen(m)}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-dj-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900">{m.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Desde {format(new Date(m.start_date + 'T12:00:00'), "d MMM yyyy", { locale: es })}
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDelete(m.id) }}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={15}/>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <FormModal title="Nuevo macrociclo" onClose={() => setShowForm(false)}>
          <label className="text-xs font-medium text-gray-600 block mb-1">Nombre</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Ej: Temporada 2026"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-dj-400"
          />
          <label className="text-xs font-medium text-gray-600 block mb-1">Fecha de inicio</label>
          <input
            type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-dj-400"
          />
          <Button
            className="w-full"
            disabled={!name.trim()}
            onClick={() => { onCreate(name.trim(), startDate); setShowForm(false); setName('') }}
          >
            Crear
          </Button>
        </FormModal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// NIVEL 2 — Lista de Mesociclos
// ════════════════════════════════════════════════════════════════════════════
function MesoList({ macro, mesos, loading, onBack, onOpen, onCreate, onDelete }: {
  macro: Macrocycle
  mesos: Mesocycle[]
  loading: boolean
  onBack: () => void
  onOpen: (m: Mesocycle) => void
  onCreate: (name: string, objective: string) => void
  onDelete: (id: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-dj-600">
          <ChevronLeft size={16}/> Volver
        </button>
        <Button size="sm" icon={<Plus size={15}/>} onClick={() => setShowForm(true)}>
          Nuevo mesociclo
        </Button>
      </div>

      <h2 className="text-lg font-bold text-gray-900 font-display">{macro.name} — Mesociclos</h2>

      {loading && <p className="text-sm text-gray-400">Cargando...</p>}

      {!loading && mesos.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-sm">Todavía no hay mesociclos en este macrociclo.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {mesos.map(m => (
          <div
            key={m.id}
            onClick={() => onOpen(m)}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-dj-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900">Mesociclo {m.number}</p>
                {m.name && <p className="text-sm text-gray-600 mt-0.5">{m.name}</p>}
                {m.objective && <p className="text-xs text-gray-400 mt-1">{m.objective}</p>}
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDelete(m.id) }}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={15}/>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <FormModal title="Nuevo mesociclo" onClose={() => setShowForm(false)}>
          <p className="text-xs text-gray-400 mb-3">El número se asigna automáticamente.</p>
          <label className="text-xs font-medium text-gray-600 block mb-1">Nombre (opcional)</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Ej: Pretemporada física"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-dj-400"
          />
          <label className="text-xs font-medium text-gray-600 block mb-1">Objetivo (opcional)</label>
          <textarea
            value={objective} onChange={e => setObjective(e.target.value)}
            rows={3}
            placeholder="Ej: Desarrollar base física y técnica individual"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-dj-400"
          />
          <Button
            className="w-full"
            onClick={() => { onCreate(name.trim(), objective.trim()); setShowForm(false); setName(''); setObjective('') }}
          >
            Crear
          </Button>
        </FormModal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// NIVEL 3 — Lista de Microciclos
// ════════════════════════════════════════════════════════════════════════════
function MicroList({ meso, micros, loading, onBack, onOpen, onCreate, onDelete }: {
  meso: Mesocycle
  micros: Microcycle[]
  loading: boolean
  onBack: () => void
  onOpen: (m: Microcycle) => void
  onCreate: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-dj-600">
          <ChevronLeft size={16}/> Volver
        </button>
        <Button size="sm" icon={<Plus size={15}/>} onClick={onCreate}>
          Nuevo microciclo
        </Button>
      </div>

      <h2 className="text-lg font-bold text-gray-900 font-display">Mesociclo {meso.number} — Microciclos</h2>

      {loading && <p className="text-sm text-gray-400">Cargando...</p>}

      {!loading && micros.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-sm">Todavía no hay microciclos en este mesociclo.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {micros.map(m => {
          const weekStart = new Date(m.week_start_date + 'T12:00:00')
          const weekEnd = addWeeks(weekStart, 0)
          weekEnd.setDate(weekStart.getDate() + 6)
          return (
            <div
              key={m.id}
              onClick={() => onOpen(m)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-dj-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">Microciclo {m.number}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Calendar size={12}/>
                    {format(weekStart, 'd MMM', { locale: es })} – {format(weekEnd, 'd MMM', { locale: es })}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(m.id) }}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={15}/>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// EDITOR DEL MICROCICLO (la grilla tipo imagen: columnas por día, momentos apilables)
// ════════════════════════════════════════════════════════════════════════════
function MicrocycleEditor({ microcycle, mesocycle, onBack, onToast }: {
  microcycle: Microcycle
  mesocycle: Mesocycle
  onBack: () => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
}) {
  const [days, setDays] = useState<Record<string, MicrocycleDay | null>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const weekStart = new Date(microcycle.week_start_date + 'T12:00:00')
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  useEffect(() => {
    setLoading(true)
    listMicrocycleDays(microcycle.id)
      .then(existing => {
        const map: Record<string, MicrocycleDay | null> = {}
        weekDates.forEach(d => {
          const key = format(d, 'yyyy-MM-dd')
          map[key] = existing.find(e => e.date === key) ?? null
        })
        setDays(map)
      })
      .catch(() => onToast({ msg: 'Error al cargar el microciclo.', type: 'error' }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microcycle.id])

  function getDay(dateKey: string): MicrocycleDay {
    return days[dateKey] ?? {
      id: '', microcycle_id: microcycle.id, date: dateKey,
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

  async function handleSave() {
    setSaving(true)
    try {
      const promises = Object.entries(days).map(([dateKey, day]) => {
        if (!day) return Promise.resolve()
        // Solo guarda días que tengan algo (etiqueta o al menos un momento)
        if (!day.day_label && day.moments.length === 0) return Promise.resolve()
        return upsertMicrocycleDay({
          microcycle_id: microcycle.id,
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
        mesocycleNumber: mesocycle.number,
        microcycleNumber: microcycle.number,
        weekStart,
        days: orderedDays,
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Cargando microciclo...</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-dj-600">
          <ChevronLeft size={16}/> Volver
        </button>
        <div className="flex gap-2">
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
          MESOCICLO {mesocycle.number} | MICROCICLO {microcycle.number}
        </h2>
        <p className="text-white/60 text-xs mt-0.5">
          {format(weekStart, "d 'de' MMMM", { locale: es })} – {format(weekDates[6], "d 'de' MMMM yyyy", { locale: es })}
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
            />
          )
        })}
      </div>
    </div>
  )
}

function DayColumn({ label, date, day, onLabelChange, onAddMoment, onRemoveMoment, onMomentChange }: {
  label: string
  date: Date
  day: MicrocycleDay
  onLabelChange: (v: string) => void
  onAddMoment: () => void
  onRemoveMoment: (id: string) => void
  onMomentChange: (id: string, v: string) => void
}) {
  const sortedMoments = [...day.moments].sort((a, b) => a.order - b.order)
  const isMatch = day.day_label?.toLowerCase().includes('vs') || day.rival_logo_url

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
          className={clsx(
            'w-full text-xs font-bold text-center rounded-xl px-2 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-dj-400',
            isMatch ? 'bg-gold-100 text-gold-800' : 'bg-amber-50 text-amber-800',
          )}
        />
      </div>

      <div className="flex-1 px-2 pb-2 space-y-1.5">
        {sortedMoments.map((m, i) => (
          <MomentBlock
            key={m.id}
            index={i}
            moment={m}
            onChange={v => onMomentChange(m.id, v)}
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

function MomentBlock({ index, moment, onChange, onRemove }: {
  index: number
  moment: MicrocycleMoment
  onChange: (v: string) => void
  onRemove: () => void
}) {
  return (
    <div className="bg-dj-100 rounded-xl px-2.5 py-2 group relative">
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] font-bold text-dj-700 mt-0.5 shrink-0">M{index + 1}:</span>
        <textarea
          value={moment.content}
          onChange={e => onChange(e.target.value)}
          placeholder="Contenido..."
          rows={2}
          className="flex-1 bg-transparent text-xs font-semibold text-dj-900 resize-none focus:outline-none placeholder:text-dj-400 placeholder:font-normal"
        />
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-dj-400 hover:text-red-500 transition-opacity shrink-0"
        >
          <X size={12}/>
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Modal genérico para formularios de creación
// ════════════════════════════════════════════════════════════════════════════
function FormModal({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18}/>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
