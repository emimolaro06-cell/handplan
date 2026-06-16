import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Save, FileDown, Plus, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Button, Toast, Textarea } from '@/components/ui/index'
import { CONTENT_CATEGORIES } from '@/lib/constants'
import type { TeamCategory, ContentCategory } from '@/types'
import { downloadMonthlyPDF } from '@/lib/pdfMonthly'

interface DayData {
  contents: ContentCategory[]
  note: string // para partidos / notas del día
}

interface MonthPlan {
  id?: string
  user_id: string
  team_category: TeamCategory
  year: number
  month: number // 1-12
  rivals: string
  monthly_contents: string
  observations: string
  days: Record<string, DayData> // key: 'YYYY-MM-DD'
}

const CONTENT_SHORT: Record<ContentCategory, string> = {
  'Técnica individual OFENSIVA': 'TÉC IND OF',
  'Técnica individual DEFENSIVA': 'TÉC IND DEF',
  'Táctica OFENSIVA': 'TAC OF',
  'Táctica DEFENSIVA': 'TAC DEF',
  'MIXTO': 'MIXTO',
}

const CONTENT_COLOR: Record<ContentCategory, string> = {
  'Técnica individual OFENSIVA': 'bg-dj-600 text-white',
  'Técnica individual DEFENSIVA': 'bg-blue-600 text-white',
  'Táctica OFENSIVA': 'bg-amber-500 text-white',
  'Táctica DEFENSIVA': 'bg-purple-600 text-white',
  'MIXTO': 'bg-gray-600 text-white',
}

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function MonthlyPlanPage() {
  const { profile, selectedCategory } = useAppStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [plan, setPlan] = useState<MonthPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showDayModal, setShowDayModal] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const category = selectedCategory as TeamCategory

  // Días del calendario (incluyendo días de meses adyacentes para completar semanas)
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd })

  // Cargar plan del mes
  useEffect(() => {
    if (!profile || !category) return
    supabase
      .from('monthly_plans')
      .select('*')
      .eq('user_id', profile.id)
      .eq('team_category', category)
      .eq('year', year)
      .eq('month', month)
      .single()
      .then(({ data }) => {
        if (data) {
          setPlan(data as MonthPlan)
        } else {
          setPlan({
            user_id: profile.id,
            team_category: category,
            year,
            month,
            rivals: '',
            monthly_contents: '',
            observations: '',
            days: {},
          })
        }
      })
  }, [profile, category, year, month])

  function getDayKey(date: Date) {
    return format(date, 'yyyy-MM-dd')
  }

  function getDayData(date: Date): DayData {
    const key = getDayKey(date)
    return plan?.days[key] ?? { contents: [], note: '' }
  }

  function updateDayData(dateKey: string, data: DayData) {
    setPlan(prev => prev ? ({
      ...prev,
      days: { ...prev.days, [dateKey]: data }
    }) : prev)
  }

  function addContent(dateKey: string, content: ContentCategory) {
    const current = plan?.days[dateKey] ?? { contents: [], note: '' }
    if (current.contents.includes(content)) return
    updateDayData(dateKey, { ...current, contents: [...current.contents, content] })
  }

  function removeContent(dateKey: string, content: ContentCategory) {
    const current = plan?.days[dateKey] ?? { contents: [], note: '' }
    updateDayData(dateKey, { ...current, contents: current.contents.filter(c => c !== content) })
  }

  function updateNote(dateKey: string, note: string) {
    const current = plan?.days[dateKey] ?? { contents: [], note: '' }
    updateDayData(dateKey, { ...current, note })
  }

  async function handleSave() {
    if (!plan || !profile) return
    setSaving(true)
    const { id, ...rest } = plan
    if (id) {
      await supabase.from('monthly_plans').update(rest).eq('id', id)
    } else {
      const { data } = await supabase.from('monthly_plans').insert(rest).select().single()
      if (data) setPlan(data as MonthPlan)
    }
    setSaving(false)
    setToast({ msg: 'Planificación guardada.', type: 'success' })
  }

  async function handleExportPDF() {
    if (!plan) return
    await downloadMonthlyPDF(plan, currentDate)
  }

  function prevMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  function nextMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  const selectedDayData = selectedDay ? getDayData(new Date(selectedDay + 'T12:00:00')) : null

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Planificación mensual</h1>
          <p className="text-gray-500 text-sm mt-0.5">{category}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<FileDown size={15}/>} onClick={handleExportPDF}>
            PDF
          </Button>
          <Button size="sm" icon={<Save size={15}/>} loading={saving} onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* ── Panel izquierdo ── */}
        <div className="w-56 flex-shrink-0 space-y-3">
          {/* Navegación de mes */}
          <div className="bg-dj-800 rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between mb-1">
              <button onClick={prevMonth} className="hover:text-gold-400 transition-colors">
                <ChevronLeft size={18}/>
              </button>
              <div className="text-center">
                <p className="font-bold text-base capitalize">
                  {format(currentDate, 'MMMM', { locale: es })}
                </p>
                <p className="text-white/60 text-xs">{year}</p>
              </div>
              <button onClick={nextMonth} className="hover:text-gold-400 transition-colors">
                <ChevronRight size={18}/>
              </button>
            </div>
          </div>

          {/* Info del mes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Info del mes</p>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Rivales a enfrentar</label>
              <textarea
                value={plan?.rivals ?? ''}
                onChange={e => setPlan(p => p ? ({ ...p, rivals: e.target.value }) : p)}
                placeholder="Club X, Club Y..."
                rows={3}
                className="w-full text-xs rounded-xl border border-gray-200 px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-dj-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Contenidos a trabajar</label>
              <textarea
                value={plan?.monthly_contents ?? ''}
                onChange={e => setPlan(p => p ? ({ ...p, monthly_contents: e.target.value }) : p)}
                placeholder="Ej: Técnica individual ofensiva..."
                rows={3}
                className="w-full text-xs rounded-xl border border-gray-200 px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-dj-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Observaciones</label>
              <textarea
                value={plan?.observations ?? ''}
                onChange={e => setPlan(p => p ? ({ ...p, observations: e.target.value }) : p)}
                placeholder="Notas generales del mes..."
                rows={3}
                className="w-full text-xs rounded-xl border border-gray-200 px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-dj-400"
              />
            </div>
          </div>

          {/* Referencia de colores */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Referencias</p>
            {CONTENT_CATEGORIES.map(c => (
              <div key={c} className="flex items-center gap-2">
                <span className={clsx('text-xs px-2 py-0.5 rounded-lg font-bold', CONTENT_COLOR[c])}>
                  {CONTENT_SHORT[c]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Calendario ── */}
        <div className="flex-1 min-w-0">
          {/* Cabecera días */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_ES.map(d => (
              <div key={d} className={clsx(
                'text-center text-xs font-bold py-2 uppercase tracking-wide',
                d === 'Dom' || d === 'Sáb' ? 'text-dj-600' : 'text-gray-500'
              )}>
                {d}
              </div>
            ))}
          </div>

          {/* Grilla de días */}
          <div className="grid grid-cols-7 gap-1">
            {calDays.map(day => {
              const key = getDayKey(day)
              const dayData = getDayData(day)
              const inMonth = isSameMonth(day, currentDate)
              const isWeekend = day.getDay() === 0 || day.getDay() === 6
              const todayDay = isToday(day)

              return (
                <div
                  key={key}
                  onClick={() => { if (inMonth) { setSelectedDay(key); setShowDayModal(true) } }}
                  className={clsx(
                    'min-h-20 rounded-xl p-1.5 border transition-all cursor-pointer',
                    inMonth ? 'bg-white hover:shadow-md hover:border-dj-300' : 'bg-gray-50 opacity-40 cursor-default',
                    isWeekend && inMonth ? 'border-dj-100' : 'border-gray-100',
                    todayDay ? 'border-dj-500 ring-2 ring-dj-200' : '',
                  )}
                >
                  {/* Número del día */}
                  <div className={clsx(
                    'text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1',
                    todayDay ? 'bg-dj-600 text-white' : isWeekend && inMonth ? 'text-dj-600' : 'text-gray-700',
                  )}>
                    {format(day, 'd')}
                  </div>

                  {/* Contenidos del día */}
                  <div className="space-y-0.5">
                    {dayData.contents.map(c => (
                      <div key={c} className={clsx('text-xs px-1.5 py-0.5 rounded-md font-bold truncate', CONTENT_COLOR[c])}>
                        {CONTENT_SHORT[c]}
                      </div>
                    ))}
                    {dayData.note && (
                      <div className="text-xs px-1.5 py-0.5 rounded-md bg-gold-100 text-gold-800 font-medium truncate">
                        {dayData.note}
                      </div>
                    )}
                    {inMonth && dayData.contents.length === 0 && !dayData.note && (
                      <div className="text-gray-300 text-xs text-center mt-1">+</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Modal de día ── */}
      {showDayModal && selectedDay && selectedDayData && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowDayModal(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">
                {format(new Date(selectedDay + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
              </h3>
              <button onClick={() => setShowDayModal(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Contenidos seleccionados */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Contenido del día</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedDayData.contents.map(c => (
                    <div key={c} className={clsx('flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-bold', CONTENT_COLOR[c])}>
                      {CONTENT_SHORT[c]}
                      <button onClick={() => { removeContent(selectedDay, c); setShowDayModal(false); setTimeout(() => setShowDayModal(true), 0) }}>
                        <X size={10}/>
                      </button>
                    </div>
                  ))}
                  {selectedDayData.contents.length === 0 && (
                    <p className="text-xs text-gray-400">Sin contenido todavía</p>
                  )}
                </div>

                {/* Agregar contenido */}
                <div className="grid grid-cols-1 gap-1.5">
                  {CONTENT_CATEGORIES.filter(c => !selectedDayData.contents.includes(c)).map(c => (
                    <button
                      key={c}
                      onClick={() => { addContent(selectedDay, c); setShowDayModal(false); setTimeout(() => setShowDayModal(true), 0) }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:border-dj-400 text-sm text-gray-700 hover:text-dj-700 transition-colors text-left"
                    >
                      <Plus size={13}/>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nota del día (partido, rival, etc.) */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Nota del día <span className="text-gray-400 font-normal">(partido, rival, observación)</span>
                </label>
                <input
                  value={selectedDayData.note}
                  onChange={e => updateNote(selectedDay, e.target.value)}
                  placeholder="Ej: vs Club Atlético"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
                />
              </div>

              <Button className="w-full" onClick={() => setShowDayModal(false)}>
                Listo
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
