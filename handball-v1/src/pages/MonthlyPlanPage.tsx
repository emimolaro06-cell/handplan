import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Save, FileDown, Plus, X, ChevronDown, ChevronUp, CalendarDays, LayoutGrid } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Button, Toast } from '@/components/ui/index'
import { CONTENT_CATEGORIES } from '@/lib/constants'
import { downloadMonthlyPDF } from '@/lib/pdfMonthly'
import { MicrocyclesPage } from '@/pages/MicrocyclesPage'
import type { TeamCategory, ContentCategory } from '@/types'

interface DayData {
  contents: ContentCategory[]
  note: string
}

interface MonthPlan {
  id?: string
  user_id: string
  team_category: TeamCategory
  year: number
  month: number
  rivals: string
  monthly_contents: string
  observations: string
  days: Record<string, DayData>
}

type ViewMode = 'month' | 'cycles'

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

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function MonthlyPlanPage() {
  const { profile, selectedCategory } = useAppStore()
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [plan, setPlan] = useState<MonthPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showDayModal, setShowDayModal] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const category = selectedCategory as TeamCategory

  const monthStart = startOfMonth(currentDate)
  const monthEnd   = endOfMonth(currentDate)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd     = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd })

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
            year, month,
            rivals: '', monthly_contents: '', observations: '',
            days: {},
          })
        }
      })
  }, [profile, category, year, month])

  function getDayKey(date: Date) { return format(date, 'yyyy-MM-dd') }

  function getDayData(date: Date): DayData {
    const key = getDayKey(date)
    return plan?.days[key] ?? { contents: [], note: '' }
  }

  function updateDayData(dateKey: string, data: DayData) {
    setPlan(prev => prev ? ({ ...prev, days: { ...prev.days, [dateKey]: data } }) : prev)
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
    setExporting(true)
    try {
      await downloadMonthlyPDF(plan, currentDate)
    } finally {
      setExporting(false)
    }
  }

  function goPrev() { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function goNext() { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  const selectedDayData = selectedDay ? getDayData(new Date(selectedDay + 'T12:00:00')) : null

  return (
    <div className="space-y-4 pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-display">Planificación</h1>
            <p className="text-gray-500 text-sm mt-0.5">{category}</p>
          </div>

          {/* Toggle Mes / Microciclos */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('month')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                viewMode === 'month' ? 'bg-white shadow-sm text-dj-700' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <CalendarDays size={14}/> Mes
            </button>
            <button
              onClick={() => setViewMode('cycles')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                viewMode === 'cycles' ? 'bg-white shadow-sm text-dj-700' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <LayoutGrid size={14}/> Macrociclo
            </button>
          </div>

          {/* Navegación de mes — solo aplica a la vista Mes */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-2 bg-dj-800 rounded-xl px-3 py-2">
              <button onClick={goPrev} className="text-white/60 hover:text-white">
                <ChevronLeft size={18}/>
              </button>
              <p className="text-white font-bold text-sm capitalize min-w-40 text-center">
                {format(currentDate, 'MMMM yyyy', { locale: es })}
              </p>
              <button onClick={goNext} className="text-white/60 hover:text-white">
                <ChevronRight size={18}/>
              </button>
            </div>
          )}
        </div>

        {viewMode === 'month' && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<FileDown size={15}/>} loading={exporting} onClick={handleExportPDF}>
              PDF
            </Button>
            <Button size="sm" icon={<Save size={15}/>} loading={saving} onClick={handleSave}>
              Guardar
            </Button>
          </div>
        )}
      </div>

      {/* ── VISTA MICROCICLOS (Macrociclo → Mesociclo → Microciclos → Editor) ── */}
      {viewMode === 'cycles' && <MicrocyclesPage/>}

      {/* ── VISTA MES ── */}
      {viewMode === 'month' && (
        <>
          {/* Panel de info del mes (colapsable) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              onClick={() => setShowInfo(!showInfo)}
            >
              <span className="font-semibold text-gray-800 text-sm">Info del mes</span>
              {showInfo ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
            </button>
            {showInfo && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-5 pb-5">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Rivales a enfrentar</label>
                  <textarea
                    value={plan?.rivals ?? ''}
                    onChange={e => setPlan(p => p ? ({ ...p, rivals: e.target.value }) : p)}
                    placeholder="Club X, Club Y..."
                    rows={3}
                    className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-dj-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Contenidos a trabajar</label>
                  <textarea
                    value={plan?.monthly_contents ?? ''}
                    onChange={e => setPlan(p => p ? ({ ...p, monthly_contents: e.target.value }) : p)}
                    placeholder="Ej: Técnica individual ofensiva..."
                    rows={3}
                    className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-dj-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Observaciones</label>
                  <textarea
                    value={plan?.observations ?? ''}
                    onChange={e => setPlan(p => p ? ({ ...p, observations: e.target.value }) : p)}
                    placeholder="Notas generales del mes..."
                    rows={3}
                    className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-dj-400"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="grid grid-cols-7 mb-2">
              {DAYS_ES.map((d, i) => (
                <div key={d} className={clsx(
                  'text-center text-xs font-bold py-2 uppercase tracking-wide',
                  i === 0 || i === 6 ? 'text-dj-600' : 'text-gray-500'
                )}>
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
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
                      'min-h-28 rounded-xl p-2 border-2 transition-all',
                      inMonth ? 'cursor-pointer hover:shadow-md' : 'opacity-30 cursor-default',
                      todayDay ? 'border-dj-500 ring-2 ring-dj-100' :
                        isWeekend && inMonth ? 'border-dj-100 bg-dj-50/30' : 'border-gray-100 bg-white',
                      inMonth && !todayDay && !isWeekend ? 'hover:border-dj-200' : '',
                    )}
                  >
                    <div className={clsx(
                      'w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold mb-1.5',
                      todayDay ? 'bg-dj-600 text-white' :
                        isWeekend && inMonth ? 'text-dj-600' : 'text-gray-700',
                    )}>
                      {format(day, 'd')}
                    </div>

                    <div className="space-y-1">
                      {dayData.contents.map(c => (
                        <div key={c} className={clsx('text-[13px] leading-tight px-2 py-1 rounded-lg font-bold truncate', CONTENT_COLOR[c])}>
                          {CONTENT_SHORT[c]}
                        </div>
                      ))}
                      {dayData.note && (
                        <div className="text-[13px] leading-tight px-2 py-1 rounded-lg bg-gold-100 text-gold-800 font-medium truncate">
                          {dayData.note}
                        </div>
                      )}
                      {inMonth && dayData.contents.length === 0 && !dayData.note && (
                        <div className="text-gray-300 text-xs text-center py-1">+</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Referencias */}
          <div className="flex flex-wrap gap-2">
            {CONTENT_CATEGORIES.map(c => (
              <span key={c} className={clsx('text-xs px-3 py-1.5 rounded-xl font-bold', CONTENT_COLOR[c])}>
                {CONTENT_SHORT[c]}
              </span>
            ))}
          </div>

          {/* Modal día */}
          {showDayModal && selectedDay && selectedDayData && (
            <div
              className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
              onClick={e => { if (e.target === e.currentTarget) setShowDayModal(false) }}
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 capitalize">
                    {format(new Date(selectedDay + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                  </h3>
                  <button onClick={() => setShowDayModal(false)} className="text-gray-400 hover:text-gray-700">
                    <X size={18}/>
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  {selectedDayData.contents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDayData.contents.map(c => (
                        <div key={c} className={clsx('flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl font-bold', CONTENT_COLOR[c])}>
                          {CONTENT_SHORT[c]}
                          <button onClick={() => {
                            removeContent(selectedDay, c)
                            setShowDayModal(false)
                            setTimeout(() => setShowDayModal(true), 10)
                          }}>
                            <X size={11}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Agregar contenido</p>
                    <div className="space-y-1.5">
                      {CONTENT_CATEGORIES.filter(c => !selectedDayData.contents.includes(c)).map(c => (
                        <button
                          key={c}
                          onClick={() => {
                            addContent(selectedDay, c)
                            setShowDayModal(false)
                            setTimeout(() => setShowDayModal(true), 10)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:border-dj-400 hover:bg-dj-50 text-sm text-gray-700 transition-colors text-left"
                        >
                          <Plus size={13} className="text-dj-500"/>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Nota del día <span className="text-gray-400">(partido, rival, observación)</span>
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
        </>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
