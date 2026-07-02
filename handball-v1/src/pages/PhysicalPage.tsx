import { useState, useEffect, useMemo, useRef } from 'react'
import { X, UserPlus, Trash2, ChevronLeft, ChevronRight, Plus, Settings } from 'lucide-react'
import { format, addMonths, subMonths, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button, Toast, Card, Empty } from '@/components/ui/index'
import {
  listPlayers, addPlayer, deletePlayer,
  getAttendanceForTurnoInRange, setAttendanceStatus, clearAttendanceStatus, clearAttendanceDay,
  setAttendancePSE, getMonthRange, getAttendanceHeader, saveAttendanceHeader,
} from '@/lib/attendance'
import {
  computeSRPE, pseColorClass, pseChartColor,
  getWeekDays, saveWeekDays, getDatesForWeekDays,
  WEEK_DAY_LABELS, WEEK_DAY_FULL,
} from '@/lib/attendanceWeekDays'
import type { Player, AttendanceRecord, AttendanceStatus, TeamCategory } from '@/types'

const STATUS_STYLE: Record<AttendanceStatus, { label: string; cls: string }> = {
  presente:  { label: 'P', cls: 'bg-emerald-100 text-emerald-700' },
  ausente:   { label: 'A', cls: 'bg-red-100 text-red-700' },
  lesionado: { label: 'L', cls: 'bg-amber-100 text-amber-700' },
}

const TURNO = 'Preparación física'

export function PhysicalPage() {
  const { effectiveUserId, selectedCategory, account } = useAppStore()
  const category = selectedCategory as TeamCategory

  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [refMonth, setRefMonth] = useState(new Date())

  // Records levantados desde PhysicalGrid para que los charts los usen sin fetchear solos
  const [fisicoRecords, setFisicoRecords] = useState<AttendanceRecord[]>([])
  const [pelotaRecords, setPelotaRecords] = useState<AttendanceRecord[]>([])

  // Configuración de días fijos y semana inicial
  const [weekDays, setWeekDays] = useState<number[]>([])
  const [baseWeek, setBaseWeek] = useState<number>(1)
  const [showWeekConfig, setShowWeekConfig] = useState(false)

  useEffect(() => {
    if (!effectiveUserId || !category) return
    setLoading(true)
    listPlayers(effectiveUserId, category)
      .then(setPlayers)
      .catch(() => setToast({ msg: 'Error al cargar jugadores.', type: 'error' }))
      .finally(() => setLoading(false))
    // Cargar días fijos de Físico
    getWeekDays(effectiveUserId, category, TURNO).then(setWeekDays).catch(() => {})
    // Cargar semana inicial desde localStorage
    const stored = localStorage.getItem(`handplan_phys_baseweek_${category}`)
    if (stored) setBaseWeek(Number(stored))
  }, [effectiveUserId, category])

  async function handleToggleWeekDay(day: number) {
    if (!effectiveUserId || !category) return
    const newDays = weekDays.includes(day)
      ? weekDays.filter(d => d !== day)
      : [...weekDays, day].sort()
    setWeekDays(newDays)
    await saveWeekDays(effectiveUserId, category, TURNO, newDays).catch(() => {})
  }

  function handleBaseWeekChange(val: number) {
    setBaseWeek(val)
    localStorage.setItem(`handplan_phys_baseweek_${category}`, String(val))
  }

  if (!category) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center space-y-2">
        <p className="text-gray-500 font-medium">Seleccioná una categoría desde el menú lateral</p>
        <p className="text-gray-400 text-sm">para ver la Preparación Física del equipo.</p>
      </div>
    </div>
  )

  async function handleAddPlayer() {
    if (!effectiveUserId || !newPlayerName.trim()) return
    try {
      const created = await addPlayer(effectiveUserId, category, newPlayerName.trim(), account?.id ?? null)
      setPlayers(prev => [...prev, created].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setNewPlayerName(''); setShowAddPlayer(false)
      setToast({ msg: 'Jugador agregado.', type: 'success' })
    } catch { setToast({ msg: 'Error al agregar jugador.', type: 'error' }) }
  }

  async function handleDeletePlayer(id: string) {
    if (!confirm('¿Eliminar este jugador? También se borra su historial.')) return
    try {
      await deletePlayer(id)
      setPlayers(prev => prev.filter(p => p.id !== id))
      setToast({ msg: 'Jugador eliminado.', type: 'success' })
    } catch { setToast({ msg: 'Error al eliminar.', type: 'error' }) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Preparación Física</h1>
          <p className="text-gray-500 text-sm mt-0.5">{category} · PSE y carga de entrenamiento</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" icon={<Settings size={15}/>} onClick={() => setShowWeekConfig(true)}>
            Días fijos
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
            description="Agregá los jugadores de tu categoría."
            action={<Button onClick={() => setShowAddPlayer(true)}>Agregar jugador</Button>}
          />
        </Card>
      ) : (
        <>
          <PhysicalGrid
            players={players}
            category={category}
            coachId={effectiveUserId}
            refMonth={refMonth}
            setRefMonth={setRefMonth}
            onDeletePlayer={handleDeletePlayer}
            onToast={setToast}
            onRecordsChange={(fisico, pelota) => { setFisicoRecords(fisico); setPelotaRecords(pelota) }}
            weekDays={weekDays}
          />
          <PSEChart players={players} fisicoRecords={fisicoRecords} refMonth={refMonth} weekDays={weekDays} baseWeek={baseWeek} />
          <SRPEChart players={players} fisicoRecords={fisicoRecords} pelotaRecords={pelotaRecords} refMonth={refMonth} weekDays={weekDays} baseWeek={baseWeek} />
        </>
      )}

      {/* Modal agregar jugador */}
      {showAddPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Agregar jugador</h3>
              <button type="button" onClick={() => setShowAddPlayer(false)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>
            <input
              type="text" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
              placeholder="Nombre completo"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowAddPlayer(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleAddPlayer} disabled={!newPlayerName.trim()}>Agregar</Button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}

      {/* Modal: días fijos y semana inicial */}
      {showWeekConfig && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Configuración de carga</h3>
              <button type="button" onClick={() => setShowWeekConfig(false)} className="text-gray-400 hover:text-gray-700"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Días de entrenamiento</p>
                <p className="text-xs text-gray-400 mb-3">Los gráficos mostrarán solo estos días agrupados por semana.</p>
                <div className="flex gap-2 flex-wrap">
                  {WEEK_DAY_LABELS.map((label, day) => (
                    <button key={day} type="button"
                      onClick={() => handleToggleWeekDay(day)}
                      title={WEEK_DAY_FULL[day]}
                      className={clsx('w-10 h-10 rounded-xl text-sm font-bold transition-colors',
                        weekDays.includes(day) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                      {label}
                    </button>
                  ))}
                </div>
                {weekDays.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    {weekDays.map(d => WEEK_DAY_FULL[d]).join(', ')}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Semana inicial del mes</p>
                <p className="text-xs text-gray-400 mb-3">¿Qué número de semana corresponde a la primera semana de este mes? (ej: 54)</p>
                <input
                  type="number" min={1} max={99}
                  value={baseWeek}
                  onChange={e => handleBaseWeekChange(Number(e.target.value))}
                  className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 text-center font-semibold"
                />
              </div>
              <Button className="w-full" onClick={() => setShowWeekConfig(false)}>Listo</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// GRILLA DE PREPARACIÓN FÍSICA con PSE + sRPE
// ════════════════════════════════════════════════════════════════════════════
function PhysicalGrid({ players, category, coachId, refMonth, setRefMonth, onDeletePlayer, onToast, onRecordsChange }: {
  players: Player[]; category: string; coachId: string | null; refMonth: Date
  setRefMonth: (d: Date) => void; onDeletePlayer: (id: string) => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
  onRecordsChange: (fisico: AttendanceRecord[], pelota: AttendanceRecord[]) => void
  weekDays?: number[]
}) {
  const [fisicoRecords, setFisicoRecordsRaw] = useState<AttendanceRecord[]>([])
  const [pelotaRecords, setPelotaRecordsRaw] = useState<AttendanceRecord[]>([])
  const fisicoRef = useRef<AttendanceRecord[]>([])
  const pelotaRef = useRef<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [extraDays, setExtraDays] = useState<string[]>([])
  const [showAddDay, setShowAddDay] = useState(false)
  const [newDayValue, setNewDayValue] = useState('')
  const [headerInfo, setHeaderInfo] = useState({ coach: '', assistant: '' })
  const scrollRef = useRef<HTMLDivElement>(null)

  // Wrappers que sincronizan refs y notifican al padre
  function setFisicoRecords(updater: AttendanceRecord[] | ((prev: AttendanceRecord[]) => AttendanceRecord[])) {
    setFisicoRecordsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      fisicoRef.current = next
      onRecordsChange(next, pelotaRef.current)
      return next
    })
  }
  function setPelotaRecords(updater: AttendanceRecord[] | ((prev: AttendanceRecord[]) => AttendanceRecord[])) {
    setPelotaRecordsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      pelotaRef.current = next
      onRecordsChange(fisicoRef.current, next)
      return next
    })
  }
  function setBothRecords(fisico: AttendanceRecord[], pelota: AttendanceRecord[]) {
    fisicoRef.current = fisico
    pelotaRef.current = pelota
    setFisicoRecordsRaw(fisico)
    setPelotaRecordsRaw(pelota)
    onRecordsChange(fisico, pelota)
  }

  const playerIdsKey = players.map(p => p.id).join(',')
  const playerIds = useMemo(() => players.map(p => p.id), [playerIdsKey])
  const { start, end } = useMemo(() => getMonthRange(refMonth), [refMonth])
  const todayKey = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!coachId || !category) return
    getAttendanceHeader(coachId, category, TURNO)
      .then(h => setHeaderInfo({ coach: h.coach_name, assistant: h.assistant_name }))
  }, [coachId, category])

  useEffect(() => {
    if (playerIds.length === 0) { setLoading(false); return }
    setLoading(true)
    setExtraDays([])
    Promise.all([
      getAttendanceForTurnoInRange(playerIds, TURNO, start, end),
      getAttendanceForTurnoInRange(playerIds, 'Pelota', start, end),
    ]).then(([fisico, pelota]) => {
      setBothRecords(fisico, pelota)
      const daysWithData = Array.from(new Set(fisico.map(r => r.date))).sort()
      setExtraDays(daysWithData)
    })
    .catch(() => onToast({ msg: 'Error al cargar asistencia.', type: 'error' }))
    .finally(() => setLoading(false))
  }, [playerIdsKey, start, end])

  const days = useMemo(() => {
    const fixedDays = weekDays && weekDays.length > 0 ? getDatesForWeekDays(refMonth, weekDays) : []
    return Array.from(new Set([...fixedDays, ...extraDays])).sort()
  }, [extraDays, weekDays, refMonth])

  function getStatus(playerId: string, date: string): AttendanceStatus | null {
    return (fisicoRecords.find(r => r.player_id === playerId && r.date === date)?.status ?? null) as AttendanceStatus | null
  }
  function getPSE(playerId: string, date: string): number | null {
    return fisicoRecords.find(r => r.player_id === playerId && r.date === date)?.pse
      ?? pelotaRecords.find(r => r.player_id === playerId && r.date === date)?.pse
      ?? null
  }
  function getPelotaPresent(playerId: string, date: string): boolean {
    return pelotaRecords.find(r => r.player_id === playerId && r.date === date)?.status === 'presente'
  }

  async function handleToggleFisico(playerId: string, date: string) {
    const current = getStatus(playerId, date)
    try {
      if (current === 'presente') {
        // presente → null (limpiar)
        await clearAttendanceStatus(playerId, date, TURNO)
        await setAttendancePSE(playerId, date, TURNO, null).catch(() => {})
        setFisicoRecords(prev => prev.filter(r => !(r.player_id === playerId && r.date === date)))
      } else {
        // null/ausente → presente
        await setAttendanceStatus(playerId, date, TURNO, 'presente')
        setFisicoRecords(prev => {
          const existing = prev.find(r => r.player_id === playerId && r.date === date)
          if (existing) return prev.map(r => r === existing ? { ...r, status: 'presente' } : r)
          return [...prev, { id: '', player_id: playerId, date, turno: TURNO, status: 'presente', pse: null, created_at: '' }]
        })
      }
    } catch { onToast({ msg: 'Error al guardar.', type: 'error' }) }
  }

  async function handleTogglePelota(playerId: string, date: string) {
    const isPresent = getPelotaPresent(playerId, date)
    try {
      if (isPresent) {
        await clearAttendanceStatus(playerId, date, 'Pelota')
        setPelotaRecords(prev => prev.filter(r => !(r.player_id === playerId && r.date === date)))
      } else {
        await setAttendanceStatus(playerId, date, 'Pelota', 'presente')
        setPelotaRecords(prev => {
          const existing = prev.find(r => r.player_id === playerId && r.date === date)
          if (existing) return prev.map(r => r === existing ? { ...r, status: 'presente' } : r)
          return [...prev, { id: '', player_id: playerId, date, turno: 'Pelota', status: 'presente', pse: null, created_at: '' }]
        })
      }
    } catch { onToast({ msg: 'Error al guardar.', type: 'error' }) }
  }

  async function handleSetPSE(playerId: string, date: string, pse: number | null) {
    try {
      await setAttendancePSE(playerId, date, TURNO, pse)
      setFisicoRecords(prev => prev.map(r => r.player_id === playerId && r.date === date ? { ...r, pse } : r))
    } catch { onToast({ msg: 'Error al guardar PSE.', type: 'error' }) }
  }

  async function handleSetPelotaPSE(playerId: string, date: string, pse: number | null) {
    try {
      await setAttendancePSE(playerId, date, 'Pelota', pse)
      setPelotaRecords(prev => prev.map(r => r.player_id === playerId && r.date === date ? { ...r, pse } : r))
    } catch { onToast({ msg: 'Error al guardar PSE.', type: 'error' }) }
  }

  async function handleSaveHeader(field: 'coach' | 'assistant', value: string) {
    if (!coachId) return
    const fields = field === 'coach'
      ? { coach_name: value, assistant_name: headerInfo.assistant }
      : { coach_name: headerInfo.coach, assistant_name: value }
    try { await saveAttendanceHeader(coachId, category, TURNO, fields) } catch { /* silencioso */ }
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Cargando...</p>

  return (
    <div className="space-y-3">
      {/* Navegación de mes y encabezado */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={headerInfo.coach} onChange={e => setHeaderInfo(p => ({ ...p, coach: e.target.value }))}
          onBlur={e => handleSaveHeader('coach', e.target.value)}
          placeholder="Preparador físico: Nombre"
          className="text-sm border-b border-gray-200 focus:border-gray-400 outline-none px-1 py-0.5 text-gray-600 bg-transparent w-44"/>
        <input value={headerInfo.assistant} onChange={e => setHeaderInfo(p => ({ ...p, assistant: e.target.value }))}
          onBlur={e => handleSaveHeader('assistant', e.target.value)}
          placeholder="Asistente técnico: Nombre"
          className="text-sm border-b border-gray-200 focus:border-gray-400 outline-none px-1 py-0.5 text-gray-600 bg-transparent w-44"/>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setShowAddDay(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium transition-colors">
            <Plus size={13}/> Agregar día
          </button>
          <button type="button" onClick={() => setRefMonth(subMonths(refMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft size={16}/></button>
          <span className="text-sm font-semibold text-gray-800 min-w-[100px] text-center">
            {format(refMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <button type="button" onClick={() => setRefMonth(addMonths(refMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight size={16}/></button>
        </div>
      </div>

      {/* Grilla */}
      {days.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center">
          <p className="text-gray-400 text-sm">Todavía no hay días cargados este mes.</p>
          <button type="button" onClick={() => setShowAddDay(true)} className="mt-2 text-sm font-semibold text-gray-700 hover:underline">
            Agregar el primer día
          </button>
        </div>
      ) : (
        <div ref={scrollRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-white w-36">Jugador</th>
                {days.map(d => (
                  <th key={d} className={clsx('px-2 py-3 text-center text-xs font-semibold text-gray-600 min-w-[80px]', d === todayKey && 'bg-blue-50')}>
                    <div data-day-col={d}>{format(new Date(d + 'T12:00'), 'd/MM')}</div>
                    <div className="text-[10px] text-gray-400">{format(new Date(d + 'T12:00'), 'EEE', { locale: es })}</div>
                    <div className="flex justify-center gap-1 mt-0.5 text-[9px] font-bold">
                      <span className="text-emerald-500">F</span>
                      <span className="text-blue-400">P</span>
                    </div>
                    <button type="button" onClick={async () => {
                      if (!confirm('¿Borrar este día? Se eliminarán todos los registros.')) return
                      try {
                        await clearAttendanceDay(d, TURNO)
                        await clearAttendanceDay(d, 'Pelota')
                        const newFisico = fisicoRef.current.filter(r => r.date !== d)
                        const newPelota = pelotaRef.current.filter(r => r.date !== d)
                        setBothRecords(newFisico, newPelota)
                        setExtraDays(prev => prev.filter(x => x !== d))
                      } catch { onToast({ msg: 'Error al borrar el día.', type: 'error' }) }
                    }} className="text-gray-200 hover:text-red-400 transition-colors mt-0.5">
                      <Trash2 size={10}/>
                    </button>
                  </th>
                ))}
                <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">%F</th>
                <th className="px-2 py-3 text-xs text-gray-400 uppercase tracking-wider w-8"></th>
              </tr>
            </thead>
            <tbody>
              {players.map(player => {
                const presences = days.filter(d => getStatus(player.id, d) === 'presente').length
                const total = days.length
                const pct = total > 0 ? Math.round((presences / total) * 100) : 0
                return (
                  <tr key={player.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 font-medium text-gray-800 sticky left-0 bg-white text-sm">{player.full_name}</td>
                    {days.map(d => {
                      const fPresent = getStatus(player.id, d) === 'presente'
                      const pPresent = getPelotaPresent(player.id, d)
                      const pse = getPSE(player.id, d)
                      const { srpe, duration } = computeSRPE(player.id, d, fisicoRecords, pelotaRecords)
                      return (
                        <td key={d} className={clsx('px-1 py-1.5 border-b border-gray-50 text-center', d === todayKey && 'bg-blue-50/30')}>
                          {/* Botones F y P */}
                          <div className="flex gap-0.5 justify-center">
                            <button type="button" onClick={() => handleToggleFisico(player.id, d)}
                              title="Físico"
                              className={clsx('w-7 h-6 rounded-md text-[10px] font-bold transition-colors',
                                fPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-300 hover:bg-gray-100')}>
                              F
                            </button>
                            <button type="button" onClick={() => handleTogglePelota(player.id, d)}
                              title="Pelota"
                              className={clsx('w-7 h-6 rounded-md text-[10px] font-bold transition-colors',
                                pPresent ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-300 hover:bg-gray-100')}>
                              P
                            </button>
                          </div>
                          {/* PSE — se muestra si fue a Físico O solo a Pelota */}
                          {(fPresent || pPresent) && (
                            <>
                              <select
                                value={pse ?? ''}
                                onChange={e => {
                                  const val = e.target.value ? Number(e.target.value) : null
                                  fPresent ? handleSetPSE(player.id, d, val) : handleSetPelotaPSE(player.id, d, val)
                                }}
                                className={clsx('mt-1 w-11 h-6 text-[10px] rounded-md border border-gray-200 text-center bg-white mx-auto block font-semibold',
                                  pse ? pseColorClass(pse) : 'text-gray-500')}
                                title="PSE (1-10)">
                                <option value="">PSE</option>
                                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                              {srpe > 0 && (
                                <div className="text-[9px] text-gray-400 mt-0.5 leading-none">
                                  <span className="font-semibold text-gray-600">{srpe}</span>
                                  <span className="ml-0.5">({duration}')</span>
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-center text-xs font-bold text-gray-500">{pct}%</td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => onDeletePlayer(player.id)} className="text-gray-200 hover:text-red-400 transition-colors"><Trash2 size={12}/></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal agregar día */}
      {showAddDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 space-y-4">
            <h3 className="font-bold text-gray-900">Agregar día</h3>
            <input type="date" value={newDayValue} onChange={e => setNewDayValue(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"/>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowAddDay(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={() => {
                if (newDayValue) setExtraDays(prev => Array.from(new Set([...prev, newDayValue])).sort())
                setShowAddDay(false); setNewDayValue('')
              }} disabled={!newDayValue}>Agregar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// GRÁFICO DE PSE SEMANAL
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// GRÁFICO DE PSE SEMANAL — recibe records como prop, sin fetching propio

// ─── Helper: construye datos del gráfico por día agrupados por semana ─────────
interface ChartEntry {
  label: string      // "14/07" — clave única para XAxis
  dayLabel: string   // "Mar" — día corto
  weekLabel: string  // "Sem 54" — solo en el primer día de la semana
  weekKey: string    // clave de semana para ReferenceLine
  value: number
  color: string
  isFirstOfWeek: boolean
}

function buildChartData(
  records: AttendanceRecord[],
  pelotaRecs: AttendanceRecord[],
  players: Player[],
  refMonth: Date,
  weekDays: number[],
  baseWeek: number,
  mode: 'pse' | 'srpe',
): { entries: ChartEntry[]; separatorLabels: string[] } {
  const configuredDays = weekDays.length > 0 ? weekDays : null
  // Si no hay días configurados, usa todos los días que tienen registros
  const datesSource = configuredDays
    ? getDatesForWeekDays(refMonth, configuredDays)
    : Array.from(new Set(records.map(r => r.date))).sort()

  // Agrupar por semana (lunes como inicio)
  const weekMap = new Map<string, string[]>()
  datesSource.forEach(date => {
    const day = new Date(date + 'T12:00:00')
    const ws = startOfWeek(day, { weekStartsOn: 1 })
    const key = format(ws, 'yyyy-MM-dd')
    weekMap.set(key, [...(weekMap.get(key) ?? []), date])
  })

  const sortedWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b))
  const entries: ChartEntry[] = []
  const separatorLabels: string[] = []

  sortedWeeks.forEach(([weekKey, dates], weekIdx) => {
    const semNum = baseWeek + weekIdx
    const weekLabel = `Sem ${semNum}`

    dates.forEach((date, dayIdx) => {
      const day = new Date(date + 'T12:00:00')
      let value = 0

      if (mode === 'pse') {
        const pses = players
          .map(p => records.find(r => r.player_id === p.id && r.date === date)?.pse)
          .filter((v): v is number => v != null)
        value = pses.length > 0
          ? Math.round(pses.reduce((a, b) => a + b, 0) / pses.length * 10) / 10
          : 0
      } else {
        const srpes = players
          .map(p => computeSRPE(p.id, date, records, pelotaRecs).srpe)
          .filter(v => v > 0)
        value = srpes.length > 0
          ? Math.round(srpes.reduce((a, b) => a + b, 0) / srpes.length)
          : 0
      }

      entries.push({
        label: format(day, 'd/MM'),
        dayLabel: format(day, 'EEE', { locale: es }),
        weekLabel: dayIdx === 0 ? weekLabel : '',
        weekKey,
        value,
        isFirstOfWeek: dayIdx === 0,
        color: mode === 'pse'
          ? (value === 0 ? '#e5e7eb' : pseChartColor(value))
          : (value === 0 ? '#e5e7eb' : value < 400 ? '#639922' : value < 700 ? '#f59e0b' : value < 900 ? '#f97316' : '#e34948'),
      })
    })

    // Separador después de esta semana (excepto la última)
    if (weekIdx < sortedWeeks.length - 1 && dates.length > 0) {
      separatorLabels.push(format(new Date(dates[dates.length - 1] + 'T12:00:00'), 'd/MM'))
    }
  })

  return { entries, separatorLabels }
}

// Tick personalizado para mostrar semana arriba y día abajo
function CustomXAxisTick({ x, y, payload, data }: any) {
  const entry = data?.[payload?.index] as ChartEntry | undefined
  if (!entry) return null
  return (
    <g transform={`translate(${x},${y})`}>
      {entry.weekLabel && (
        <text x={0} y={-14} textAnchor="middle" fill="#374151" fontSize={9} fontWeight="700">
          {entry.weekLabel}
        </text>
      )}
      <text x={0} y={4} textAnchor="middle" fill="#9ca3af" fontSize={9}>
        {entry.dayLabel}
      </text>
    </g>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// GRÁFICO DE PSE POR DÍA
// ════════════════════════════════════════════════════════════════════════════
function PSEChart({ players, fisicoRecords, refMonth, weekDays, baseWeek }: {
  players: Player[]; fisicoRecords: AttendanceRecord[]
  refMonth: Date; weekDays: number[]; baseWeek: number
}) {
  const [selected, setSelected] = useState('__team__')

  const { entries, separatorLabels } = useMemo(() => {
    const relevantPlayers = selected === '__team__' ? players : players.filter(p => p.id === selected)
    return buildChartData(fisicoRecords, [], relevantPlayers, refMonth, weekDays, baseWeek, 'pse')
  }, [fisicoRecords, players, refMonth, weekDays, baseWeek, selected])

  const hasData = entries.some(e => e.value > 0)
  if (!hasData) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <p className="text-sm font-semibold text-gray-800">PSE por día</p>
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 text-gray-700 focus:outline-none">
          <option value="__team__">Equipo (promedio)</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={entries} margin={{ top: 20, right: 8, left: -20, bottom: 8 }}>
            <CartesianGrid stroke="#e1e0d9" vertical={false}/>
            <XAxis
              dataKey="label"
              tick={(props: any) => <CustomXAxisTick {...props} data={entries}/>}
              axisLine={{ stroke: '#c3c2b7' }}
              tickLine={false}
              height={32}
              interval={0}
            />
            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 10, fill: '#898781' }} axisLine={false} tickLine={false}/>
            <Tooltip
              formatter={(v: number) => [v || '—', 'PSE']}
              labelFormatter={(l: string) => {
                const e = entries.find(d => d.label === l)
                return e ? `${e.weekLabel || ''} · ${e.dayLabel} ${l}` : l
              }}
            />
            {separatorLabels.map(lbl => (
              <ReferenceLine key={lbl} x={lbl} stroke="#d1d5db" strokeDasharray="4 3" strokeWidth={1.5}/>
            ))}
            <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={32}>
              {entries.map((e, i) => <Cell key={i} fill={e.color}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#639922]"/>1-5 bajo</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]"/>6 medio-bajo</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f97316]"/>7-8 medio-alto</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#e34948]"/>9-10 alto</span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// GRÁFICO DE sRPE POR DÍA
// ════════════════════════════════════════════════════════════════════════════
function SRPEChart({ players, fisicoRecords, pelotaRecords, refMonth, weekDays, baseWeek }: {
  players: Player[]; fisicoRecords: AttendanceRecord[]; pelotaRecords: AttendanceRecord[]
  refMonth: Date; weekDays: number[]; baseWeek: number
}) {
  const [selected, setSelected] = useState('__team__')

  const { entries, separatorLabels } = useMemo(() => {
    const relevantPlayers = selected === '__team__' ? players : players.filter(p => p.id === selected)
    return buildChartData(fisicoRecords, pelotaRecords, relevantPlayers, refMonth, weekDays, baseWeek, 'srpe')
  }, [fisicoRecords, pelotaRecords, players, refMonth, weekDays, baseWeek, selected])

  const hasData = entries.some(e => e.value > 0)
  if (!hasData) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">Carga diaria (sRPE)</p>
          <p className="text-xs text-gray-400 mt-0.5">PSE × duración · agrupado por semana</p>
        </div>
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 text-gray-700 focus:outline-none">
          <option value="__team__">Equipo (promedio)</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={entries} margin={{ top: 20, right: 8, left: -10, bottom: 8 }}>
            <CartesianGrid stroke="#e1e0d9" vertical={false}/>
            <XAxis
              dataKey="label"
              tick={(props: any) => <CustomXAxisTick {...props} data={entries}/>}
              axisLine={{ stroke: '#c3c2b7' }}
              tickLine={false}
              height={32}
              interval={0}
            />
            <YAxis tick={{ fontSize: 10, fill: '#898781' }} axisLine={false} tickLine={false}/>
            <Tooltip
              formatter={(v: number) => [v || '—', 'sRPE']}
              labelFormatter={(l: string) => {
                const e = entries.find(d => d.label === l)
                return e ? `${e.weekLabel || ''} · ${e.dayLabel} ${l}` : l
              }}
            />
            {separatorLabels.map(lbl => (
              <ReferenceLine key={lbl} x={lbl} stroke="#d1d5db" strokeDasharray="4 3" strokeWidth={1.5}/>
            ))}
            <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={32}>
              {entries.map((e, i) => <Cell key={i} fill={e.color}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#639922]"/>&lt;400 baja</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]"/>400-699 moderada</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f97316]"/>700-899 alta</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#e34948]"/>≥900 muy alta</span>
      </div>
    </div>
  )
}
