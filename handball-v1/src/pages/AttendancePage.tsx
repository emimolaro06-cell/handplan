import { useState, useEffect, useMemo, useRef } from 'react'
import {
  X, UserPlus, Trash2, ChevronLeft, ChevronRight, Plus, FileDown,
} from 'lucide-react'
import { format, addMonths, subMonths, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button, Toast, Card, Empty } from '@/components/ui/index'
import {
  listPlayers, addPlayer, deletePlayer,
  getAttendanceInRange, setAttendanceStatus, clearAttendanceStatus, clearAttendanceDay, setAttendancePSE,
  computeAttendanceSummary, getMonthRange,
  getAttendanceHeader, saveAttendanceHeader, downloadAttendanceExcel,
} from '@/lib/attendance'
import { ATTENDANCE_FIXED_SHIFTS } from '@/lib/constants'
import type { Player, AttendanceRecord, AttendanceStatus, TeamCategory } from '@/types'

const STATUS_STYLE: Record<AttendanceStatus, { label: string; cls: string }> = {
  presente:  { label: 'P', cls: 'bg-emerald-100 text-emerald-700' },
  ausente:   { label: 'A', cls: 'bg-red-100 text-red-700' },
  lesionado: { label: 'L', cls: 'bg-amber-100 text-amber-700' },
}

export function AttendancePage() {
  const { profile, effectiveUserId, selectedCategory, account } = useAppStore()
  const category = selectedCategory as TeamCategory

  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')

  // Encabezado de texto libre y mes — separado por turno
  const [activeTurno, setActiveTurno] = useState<string>(ATTENDANCE_FIXED_SHIFTS[0])
  const [extraTurnos, setExtraTurnos] = useState<string[]>([])
  const [refMonth, setRefMonth] = useState(new Date())

  const [showAddTurno, setShowAddTurno] = useState(false)
  const [newTurnoName, setNewTurnoName] = useState('')
  const [pseVersion, setPseVersion] = useState(0)

  const allTurnos = [...ATTENDANCE_FIXED_SHIFTS, ...extraTurnos]

  useEffect(() => {
    if (!effectiveUserId || !category) return
    setLoading(true)
    listPlayers(effectiveUserId, category)
      .then(setPlayers)
      .catch(() => setToast({ msg: 'Error al cargar jugadores.', type: 'error' }))
      .finally(() => setLoading(false))
  }, [effectiveUserId, category])

  async function handleAddPlayer() {
    if (!effectiveUserId || !newPlayerName.trim()) return
    try {
      const created = await addPlayer(effectiveUserId, category, newPlayerName.trim(), account?.id ?? null)
      setPlayers(prev => [...prev, created].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setNewPlayerName('')
      setShowAddPlayer(false)
      setToast({ msg: 'Jugador agregado.', type: 'success' })
    } catch {
      setToast({ msg: 'Error al agregar jugador.', type: 'error' })
    }
  }

  async function handleDeletePlayer(id: string) {
    if (!confirm('¿Eliminar este jugador? También se borra su historial de asistencia.')) return
    try {
      await deletePlayer(id)
      setPlayers(prev => prev.filter(p => p.id !== id))
      setToast({ msg: 'Jugador eliminado.', type: 'success' })
    } catch {
      setToast({ msg: 'Error al eliminar.', type: 'error' })
    }
  }

  function handleAddTurno() {
    const name = newTurnoName.trim()
    if (!name) return
    if (!allTurnos.includes(name)) setExtraTurnos(prev => [...prev, name])
    setActiveTurno(name)
    setNewTurnoName('')
    setShowAddTurno(false)
  }

  const [exporting, setExporting] = useState(false)

  async function handleExportExcel() {
    if (!effectiveUserId || !category || players.length === 0) return
    setExporting(true)
    try {
      const { start, end } = getMonthRange(refMonth)
      const all = await getAttendanceInRange(players.map(p => p.id), start, end)

      const sheets = await Promise.all(
        ATTENDANCE_FIXED_SHIFTS.map(async turno => {
          const header = await getAttendanceHeader(effectiveUserId, category, turno)
          const records = all.filter(r => r.turno === turno)
          const days = Array.from(new Set(records.map(r => r.date))).sort()
          return {
            turno,
            coachName: header.coach_name,
            assistantName: header.assistant_name,
            days,
            records,
            includePSE: turno === 'Preparación física',
          }
        })
      )

      await downloadAttendanceExcel({
        category,
        monthLabel: format(refMonth, 'MMMM_yyyy', { locale: es }),
        players,
        sheets,
      })
    } catch {
      setToast({ msg: 'Error al exportar a Excel.', type: 'error' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Asistencia</h1>
          <p className="text-gray-500 text-sm mt-0.5">{category}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<FileDown size={15}/>} loading={exporting} onClick={handleExportExcel}>
            Excel
          </Button>
          <Button variant="secondary" size="sm" icon={<UserPlus size={15}/>} onClick={() => setShowAddPlayer(true)}>
            Agregar jugador
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-6">Cargando jugadores...</p>
      ) : players.length === 0 ? (
        <Card>
          <Empty
            icon={<UserPlus size={44}/>}
            title="Sin jugadores todavía"
            description="Agregá los jugadores de tu categoría para empezar a registrar asistencia."
            action={<Button onClick={() => setShowAddPlayer(true)}>Agregar jugador</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Pestañas de turno */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
            {allTurnos.map(t => (
              <button
                key={t}
                onClick={() => setActiveTurno(t)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                  activeTurno === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => setShowAddTurno(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600"
            >
              <Plus size={14}/> Turno
            </button>
          </div>

          <AttendanceGrid
            key={activeTurno}
            players={players}
            turno={activeTurno}
            category={category}
            coachId={effectiveUserId}
            refMonth={refMonth}
            setRefMonth={setRefMonth}
            onDeletePlayer={handleDeletePlayer}
            onToast={setToast}
            onPSEChange={() => setPseVersion(v => v + 1)}
          />

          {activeTurno === 'Preparación física' && (
            <PSEChart players={players} refMonth={refMonth} refreshKey={pseVersion}/>
          )}

          <CombinedSummary players={players} refMonth={refMonth} allTurnos={allTurnos}/>
        </>
      )}

      {/* Modal: agregar jugador */}
      {showAddPlayer && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowAddPlayer(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Agregar jugador</h3>
              <button onClick={() => setShowAddPlayer(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18}/>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
                placeholder="Nombre del jugador"
                autoFocus
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral2-400"
              />
              <Button className="w-full" disabled={!newPlayerName.trim()} onClick={handleAddPlayer}>
                Agregar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: agregar turno puntual */}
      {showAddTurno && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowAddTurno(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Agregar turno puntual</h3>
              <button onClick={() => setShowAddTurno(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18}/>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                value={newTurnoName}
                onChange={e => setNewTurnoName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTurno()}
                placeholder="Ej: Amistoso, Táctico extra..."
                autoFocus
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral2-400"
              />
              <Button className="w-full" disabled={!newTurnoName.trim()} onClick={handleAddTurno}>
                Agregar
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// GRILLA DE UN TURNO — jugadores × días del mes
// ════════════════════════════════════════════════════════════════════════════
function AttendanceGrid({ players, turno, category, coachId, refMonth, setRefMonth, onDeletePlayer, onToast, onPSEChange }: {
  players: Player[]
  turno: string
  category: string
  coachId: string | null
  refMonth: Date
  setRefMonth: (updater: (d: Date) => Date) => void
  onDeletePlayer: (id: string) => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
  onPSEChange: () => void
}) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [menuFor, setMenuFor] = useState<{ playerId: string; date: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayColRef = useRef<HTMLTableCellElement>(null)

  const [headerInfo, setHeaderInfo] = useState({ coach: '', assistant: '' })
  const [headerLoading, setHeaderLoading] = useState(true)

  useEffect(() => {
    if (!coachId || !category) { setHeaderLoading(false); return }
    setHeaderLoading(true)
    getAttendanceHeader(coachId, category, turno)
      .then(h => setHeaderInfo({ coach: h.coach_name, assistant: h.assistant_name }))
      .finally(() => setHeaderLoading(false))
  }, [coachId, category, turno])

  async function handleHeaderChange(field: 'coach' | 'assistant', value: string) {
    const next = { ...headerInfo, [field]: value }
    setHeaderInfo(next)
    if (!coachId || !category) return
    try {
      await saveAttendanceHeader(coachId, category, turno, {
        coach_name: next.coach, assistant_name: next.assistant,
      })
    } catch {
      onToast({ msg: 'Error al guardar el encabezado.', type: 'error' })
    }
  }

  const playerIds = useMemo(() => players.map(p => p.id), [players])
  const { start, end } = useMemo(() => getMonthRange(refMonth), [refMonth])
  const isPhysical = turno === 'Preparación física'

  // Para Pelota / turnos extra: todos los días del mes, como siempre.
  // Para Preparación física: arranca vacío y se completa con los días que tengan
  // registros guardados + los que el preparador agregue manualmente con el botón.
  const allMonthDays = useMemo(() => {
    const result: string[] = []
    const cursor = new Date(start + 'T12:00:00')
    const endDate = new Date(end + 'T12:00:00')
    while (cursor <= endDate) {
      result.push(format(cursor, 'yyyy-MM-dd'))
      cursor.setDate(cursor.getDate() + 1)
    }
    return result
  }, [start, end])

  const [extraDays, setExtraDays] = useState<string[]>([])
  const [showAddDay, setShowAddDay] = useState(false)
  const [newDayValue, setNewDayValue] = useState(format(new Date(), 'yyyy-MM-dd'))

  const daysWithData = useMemo(
    () => Array.from(new Set(records.map(r => r.date))),
    [records],
  )

  const days = isPhysical
    ? Array.from(new Set([...daysWithData, ...extraDays])).sort()
    : allMonthDays

  function handleAddDayClick() {
    const todayKey = format(new Date(), 'yyyy-MM-dd')
    if (days.includes(todayKey)) {
      // Ya existe la columna de hoy — llevar el scroll directo ahí en vez de abrir el selector.
      const el = document.querySelector(`[data-day-col="${todayKey}"]`)
      el?.scrollIntoView({ block: 'nearest', inline: 'center' })
      return
    }
    setNewDayValue(todayKey)
    setShowAddDay(true)
  }

  function confirmAddDay() {
    if (newDayValue) setExtraDays(prev => Array.from(new Set([...prev, newDayValue])))
    setShowAddDay(false)
  }

  useEffect(() => {
    setLoading(true)
    getAttendanceInRange(playerIds, start, end)
      .then(all => setRecords(all.filter(r => r.turno === turno)))
      .catch(() => onToast({ msg: 'Error al cargar la asistencia.', type: 'error' }))
      .finally(() => setLoading(false))
    setExtraDays([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerIds.join(','), start, end, turno])

  // Scroll automático a la columna de hoy, si existe (en físico puede no existir todavía)
  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => {
      todayColRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }, 50)
    return () => clearTimeout(t)
  }, [loading, turno, days.length])

  function getStatus(playerId: string, date: string): AttendanceStatus | null {
    const rec = records.find(r => r.player_id === playerId && r.date === date)
    return rec ? rec.status : null
  }

  async function handleSetStatus(playerId: string, date: string, status: AttendanceStatus | null) {
    setMenuFor(null)
    try {
      if (status === null) {
        await clearAttendanceStatus(playerId, date, turno)
        setRecords(prev => prev.filter(r => !(r.player_id === playerId && r.date === date)))
      } else {
        await setAttendanceStatus(playerId, date, turno, status)
        // El PSE solo tiene sentido con Presente — si cambia a otro estado, se limpia.
        if (status !== 'presente') {
          await setAttendancePSE(playerId, date, turno, null).catch(() => {})
          if (isPhysical) onPSEChange()
        }
        setRecords(prev => {
          const existing = prev.find(r => r.player_id === playerId && r.date === date)
          if (existing) return prev.map(r => (r === existing ? { ...r, status, pse: status === 'presente' ? r.pse : null } : r))
          return [...prev, { id: '', player_id: playerId, date, turno, status, pse: null, created_at: '' }]
        })
      }
    } catch {
      onToast({ msg: 'Error al guardar.', type: 'error' })
    }
  }

  function getPSE(playerId: string, date: string): number | null {
    const rec = records.find(r => r.player_id === playerId && r.date === date)
    return rec?.pse ?? null
  }

  async function handleSetPSE(playerId: string, date: string, pse: number | null) {
    try {
      await setAttendancePSE(playerId, date, turno, pse)
      setRecords(prev => prev.map(r => (r.player_id === playerId && r.date === date ? { ...r, pse } : r)))
      onPSEChange()
    } catch {
      onToast({ msg: 'Error al guardar el PSE.', type: 'error' })
    }
  }

  async function handleClearDay(date: string) {
    const label = format(new Date(date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })
    if (!confirm(`¿Borrar todos los registros del ${label}? Esta acción no se puede deshacer.`)) return
    try {
      await clearAttendanceDay(date, turno)
      setRecords(prev => prev.filter(r => r.date !== date))
      setExtraDays(prev => prev.filter(d => d !== date))
      onPSEChange()
    } catch {
      onToast({ msg: 'Error al borrar el día.', type: 'error' })
    }
  }

  const summary = useMemo(() => computeAttendanceSummary(players, records), [players, records])
  const todayKey = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-3">
      {/* Encabezado del turno */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-400">
              {turno === 'Preparación física' ? 'Preparador físico:' : 'Entrenador:'}
            </label>
            <input
              value={headerInfo.coach}
              onChange={e => handleHeaderChange('coach', e.target.value)}
              placeholder="Nombre"
              className="text-sm font-medium text-gray-800 border-b border-dashed border-gray-200 focus:outline-none focus:border-neutral2-400 px-1 w-32"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-400">Asistente técnico:</label>
            <input
              value={headerInfo.assistant}
              onChange={e => handleHeaderChange('assistant', e.target.value)}
              placeholder="Nombre"
              className="text-sm font-medium text-gray-800 border-b border-dashed border-gray-200 focus:outline-none focus:border-neutral2-400 px-1 w-32"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPhysical && (
            <button
              onClick={handleAddDayClick}
              className="flex items-center gap-1.5 bg-neutral2-700 hover:bg-neutral2-800 text-white text-sm font-medium px-3 py-1.5 rounded-xl transition-colors"
            >
              <Plus size={14}/> Agregar día
            </button>
          )}
          <div className="flex items-center gap-2 bg-neutral2-800 rounded-xl px-3 py-1.5">
            <button onClick={() => setRefMonth(d => subMonths(d, 1))} className="text-white/60 hover:text-white">
              <ChevronLeft size={16}/>
            </button>
            <p className="text-white font-bold text-sm capitalize min-w-28 text-center">
              {format(refMonth, 'MMMM yyyy', { locale: es })}
            </p>
            <button onClick={() => setRefMonth(d => addMonths(d, 1))} className="text-white/60 hover:text-white">
              <ChevronRight size={16}/>
            </button>
          </div>
        </div>
      </div>

      {/* Selector de fecha para agregar columna de día puntual (Preparación física) */}
      {showAddDay && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowAddDay(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Agregar día</h3>
              <button onClick={() => setShowAddDay(false)} className="text-gray-400 hover:text-gray-700">
                <X size={16}/>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                type="date"
                value={newDayValue}
                min={start}
                max={end}
                onChange={e => setNewDayValue(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral2-400"
              />
              <Button className="w-full" size="sm" onClick={confirmAddDay}>Agregar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Grilla */}
      {loading ? (
        <p className="text-sm text-gray-400 py-4">Cargando...</p>
      ) : days.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-10 text-center">
          <p className="text-sm text-gray-400">Todavía no hay días cargados este mes.</p>
          <button onClick={handleAddDayClick} className="text-sm text-neutral2-700 font-medium hover:underline mt-1">
            Agregar el primer día
          </button>
        </div>
      ) : (
        <div ref={scrollRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="border-collapse text-xs min-w-full">
            <thead>
              <tr>
                <th className="sticky left-0 bg-gray-50 text-left px-3 py-2 border-b border-gray-100 font-semibold text-gray-600 min-w-[160px] z-10">
                  Jugador
                </th>
                {days.map(d => (
                  <th
                    key={d}
                    data-day-col={d}
                    ref={d === todayKey ? todayColRef : undefined}
                    className={clsx(
                      'px-1.5 py-2 border-b border-gray-100 font-semibold text-center min-w-[52px]',
                      d === todayKey ? 'text-neutral2-700 bg-neutral2-50' : 'text-gray-500',
                    )}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{format(new Date(d + 'T12:00:00'), 'dd/MM')}</span>
                      {isPhysical && (
                        <button
                          onClick={() => handleClearDay(d)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Borrar este día"
                        >
                          <Trash2 size={11}/>
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 border-b border-gray-100 font-semibold text-neutral2-700 text-center sticky right-0 bg-gray-50">%</th>
              </tr>
            </thead>
            <tbody>
              {players.map(player => {
                const s = summary.find(s => s.player.id === player.id)
                return (
                  <tr key={player.id} className="group">
                    <td className="sticky left-0 bg-white group-hover:bg-gray-50 px-3 py-1.5 border-b border-gray-50 font-medium text-gray-800 whitespace-nowrap z-10">
                      <div className="flex items-center justify-between gap-2">
                        <span>{player.full_name}</span>
                        <button
                          onClick={() => onDeletePlayer(player.id)}
                          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </td>
                    {days.map(d => {
                      const status = getStatus(player.id, d)
                      const isOpen = menuFor?.playerId === player.id && menuFor?.date === d
                      return (
                        <td key={d} className={clsx('relative px-1 py-1 border-b border-gray-50 text-center', d === todayKey && 'bg-neutral2-50/40')}>
                          <button
                            onClick={() => setMenuFor(isOpen ? null : { playerId: player.id, date: d })}
                            className={clsx(
                              'w-9 h-7 rounded-lg text-xs font-bold transition-colors',
                              status ? STATUS_STYLE[status].cls : 'bg-gray-50 text-gray-300 hover:bg-gray-100',
                            )}
                          >
                            {status ? STATUS_STYLE[status].label : '−'}
                          </button>
                          {isPhysical && status === 'presente' && (
                            <select
                              value={getPSE(player.id, d) ?? ''}
                              onChange={e => handleSetPSE(player.id, d, e.target.value ? Number(e.target.value) : null)}
                              className="mt-1 w-9 h-6 text-[10px] rounded-md border border-gray-200 text-center text-gray-600 bg-white"
                              title="PSE (Percepción Subjetiva del Esfuerzo)"
                            >
                              <option value="">PSE</option>
                              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          )}
                          {isOpen && (
                            <div className="absolute z-20 top-full mt-1 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-gray-100 p-1 flex gap-1">
                              {(['presente', 'ausente', 'lesionado'] as AttendanceStatus[]).map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => handleSetStatus(player.id, d, opt)}
                                  className={clsx('w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center', STATUS_STYLE[opt].cls)}
                                  title={opt}
                                >
                                  {STATUS_STYLE[opt].label}
                                </button>
                              ))}
                              <button
                                onClick={() => handleSetStatus(player.id, d, null)}
                                className="w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-gray-100"
                                title="Limpiar"
                              >
                                <X size={13}/>
                              </button>
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 border-b border-gray-50 text-center font-bold text-gray-700 sticky right-0 bg-white group-hover:bg-gray-50">
                      {s ? `${s.percentage}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// RESUMEN COMBINADO — % de cada turno + % combinado
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// GRÁFICO DE PSE — promedio semanal (Percepción Subjetiva del Esfuerzo), solo
// para la pestaña "Preparación física". Barras coloreadas por nivel de esfuerzo:
// verde (1-5), amarillo (6-8), rojo (9-10).
// ════════════════════════════════════════════════════════════════════════════
function pseColor(value: number): string {
  if (value <= 5) return '#639922'
  if (value <= 8) return '#eda100'
  return '#e34948'
}

function PSEChart({ players, refMonth, refreshKey }: {
  players: Player[]; refMonth: Date; refreshKey: number
}) {
  const [selected, setSelected] = useState<string>('__team__')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const playerIds = useMemo(() => players.map(p => p.id), [players])
  const { start, end } = useMemo(() => getMonthRange(refMonth), [refMonth])

  useEffect(() => {
    setLoading(true)
    getAttendanceInRange(playerIds, start, end)
      .then(all => setRecords(all.filter(r => r.turno === 'Preparación física')))
      .finally(() => setLoading(false))
  }, [playerIds.join(','), start, end, refreshKey])

  const relevant = useMemo(
    () => records.filter(r => r.status === 'presente' && r.pse != null && (selected === '__team__' || r.player_id === selected)),
    [records, selected],
  )

  const weeklyData = useMemo(() => {
    const buckets = new Map<string, { sum: number; count: number; weekStart: Date }>()
    relevant.forEach(r => {
      const day = new Date(r.date + 'T12:00:00')
      const weekStart = startOfWeek(day, { weekStartsOn: 1 })
      const key = format(weekStart, 'yyyy-MM-dd')
      const bucket = buckets.get(key) ?? { sum: 0, count: 0, weekStart }
      bucket.sum += r.pse as number
      bucket.count += 1
      buckets.set(key, bucket)
    })
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, b], i) => ({
        label: `Sem ${i + 1}`,
        fullLabel: format(b.weekStart, "d 'de' MMM", { locale: es }),
        promedio: Math.round((b.sum / b.count) * 10) / 10,
      }))
  }, [relevant])

  if (loading) return null
  if (weeklyData.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <p className="text-sm font-semibold text-gray-800">PSE semanal — Percepción Subjetiva del Esfuerzo</p>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-neutral2-400"
        >
          <option value="__team__">Equipo</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>

      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" vertical={false}/>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false}/>
            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#898781' }} axisLine={false} tickLine={false}/>
            <Tooltip
              formatter={(value: number) => [value, 'PSE promedio']}
              labelFormatter={(label: string) => {
                const match = weeklyData.find(d => d.label === label)
                return match?.fullLabel ?? label
              }}
            />
            <Bar dataKey="promedio" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {weeklyData.map((d, i) => <Cell key={i} fill={pseColor(d.promedio)}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#639922' }}/>1-5 bajo</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#eda100' }}/>6-8 medio</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#e34948' }}/>9-10 alto</span>
      </div>
    </div>
  )
}

function CombinedSummary({ players, refMonth, allTurnos }: {
  players: Player[]; refMonth: Date; allTurnos: string[]
}) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const playerIds = useMemo(() => players.map(p => p.id), [players])
  const { start, end } = useMemo(() => getMonthRange(refMonth), [refMonth])

  useEffect(() => {
    setLoading(true)
    getAttendanceInRange(playerIds, start, end)
      .then(setRecords)
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerIds.join(','), start, end])

  const byTurno = allTurnos.map(t => {
    const recs = records.filter(r => r.turno === t && r.status !== 'lesionado')
    const total = recs.length
    const present = recs.filter(r => r.status === 'presente').length
    const pct = total > 0 ? Math.round((present / total) * 100) : 0
    return { turno: t, pct }
  })

  const combinedRecs = records.filter(r => r.status !== 'lesionado')
  const combinedTotal = combinedRecs.length
  const combinedPresent = combinedRecs.filter(r => r.status === 'presente').length
  const combinedPct = combinedTotal > 0 ? Math.round((combinedPresent / combinedTotal) * 100) : 0

  if (loading) return null

  return (
    <div className="flex gap-3 flex-wrap">
      {byTurno.map(b => (
        <div key={b.turno} className="flex-1 min-w-[140px] bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">{b.turno}</p>
          <p className="text-xl font-bold text-gray-800">{b.pct}%</p>
        </div>
      ))}
      <div className="flex-1 min-w-[140px] bg-neutral2-100 rounded-xl px-4 py-3">
        <p className="text-xs text-neutral2-700 mb-1">Combinado</p>
        <p className="text-xl font-bold text-neutral2-900">{combinedPct}%</p>
      </div>
    </div>
  )
}
