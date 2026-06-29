import { useState, useEffect, useMemo, useRef } from 'react'
import {
  X, UserPlus, Trash2, ChevronLeft, ChevronRight, Plus,
} from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button, Toast, Card, Empty } from '@/components/ui/index'
import {
  listPlayers, addPlayer, deletePlayer,
  getAttendanceInRange, setAttendanceStatus, clearAttendanceStatus,
  computeAttendanceSummary, getMonthRange,
  getAttendanceHeader, saveAttendanceHeader,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Asistencia</h1>
          <p className="text-gray-500 text-sm mt-0.5">{category}</p>
        </div>
        <Button variant="secondary" size="sm" icon={<UserPlus size={15}/>} onClick={() => setShowAddPlayer(true)}>
          Agregar jugador
        </Button>
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
          />

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
function AttendanceGrid({ players, turno, category, coachId, refMonth, setRefMonth, onDeletePlayer, onToast }: {
  players: Player[]
  turno: string
  category: string
  coachId: string | null
  refMonth: Date
  setRefMonth: (updater: (d: Date) => Date) => void
  onDeletePlayer: (id: string) => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
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

  const days = useMemo(() => {
    const result: string[] = []
    const cursor = new Date(start + 'T12:00:00')
    const endDate = new Date(end + 'T12:00:00')
    while (cursor <= endDate) {
      result.push(format(cursor, 'yyyy-MM-dd'))
      cursor.setDate(cursor.getDate() + 1)
    }
    return result
  }, [start, end])

  useEffect(() => {
    setLoading(true)
    getAttendanceInRange(playerIds, start, end)
      .then(all => setRecords(all.filter(r => r.turno === turno)))
      .catch(() => onToast({ msg: 'Error al cargar la asistencia.', type: 'error' }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerIds.join(','), start, end, turno])

  // Scroll automático a la columna de hoy, si el mes mostrado es el actual
  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => {
      todayColRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }, 50)
    return () => clearTimeout(t)
  }, [loading, turno])

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
        setRecords(prev => {
          const existing = prev.find(r => r.player_id === playerId && r.date === date)
          if (existing) return prev.map(r => (r === existing ? { ...r, status } : r))
          return [...prev, { id: '', player_id: playerId, date, turno, status, created_at: '' }]
        })
      }
    } catch {
      onToast({ msg: 'Error al guardar.', type: 'error' })
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

      {/* Grilla */}
      {loading ? (
        <p className="text-sm text-gray-400 py-4">Cargando...</p>
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
                    ref={d === todayKey ? todayColRef : undefined}
                    className={clsx(
                      'px-1.5 py-2 border-b border-gray-100 font-semibold text-center min-w-[52px]',
                      d === todayKey ? 'text-neutral2-700 bg-neutral2-50' : 'text-gray-500',
                    )}
                  >
                    {format(new Date(d + 'T12:00:00'), 'dd/MM')}
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
