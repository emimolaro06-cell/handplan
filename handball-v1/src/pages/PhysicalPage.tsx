import { useState, useEffect, useMemo, useRef } from 'react'
import { X, UserPlus, Trash2, ChevronLeft, ChevronRight, Plus, FileDown } from 'lucide-react'
import { format, addMonths, subMonths, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button, Toast, Card, Empty } from '@/components/ui/index'
import {
  listPlayers, addPlayer, deletePlayer,
  getAttendanceForTurnoInRange, setAttendanceStatus, clearAttendanceStatus,
  setAttendancePSE, getMonthRange, getAttendanceHeader, saveAttendanceHeader,
} from '@/lib/attendance'
import { computeSRPE, pseColorClass, pseChartColor, WEEK_DAY_LABELS } from '@/lib/attendanceWeekDays'
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
  const [version, setVersion] = useState(0)
  const bumpVersion = () => setVersion(v => v + 1)

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
            onVersionBump={bumpVersion}
          />
          <PSEChart players={players} refMonth={refMonth} refreshKey={version} />
          <SRPEChart players={players} refMonth={refMonth} refreshKey={version} />
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
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// GRILLA DE PREPARACIÓN FÍSICA con PSE + sRPE
// ════════════════════════════════════════════════════════════════════════════
function PhysicalGrid({ players, category, coachId, refMonth, setRefMonth, onDeletePlayer, onToast, onVersionBump }: {
  players: Player[]; category: string; coachId: string | null; refMonth: Date
  setRefMonth: (d: Date) => void; onDeletePlayer: (id: string) => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
  onVersionBump: () => void
}) {
  const [fisicoRecords, setFisicoRecords] = useState<AttendanceRecord[]>([])
  const [pelotaRecords, setPelotaRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [extraDays, setExtraDays] = useState<string[]>([])
  const [showAddDay, setShowAddDay] = useState(false)
  const [newDayValue, setNewDayValue] = useState('')
  const [menuFor, setMenuFor] = useState<{ playerId: string; date: string; x: number; y: number } | null>(null)
  const [headerInfo, setHeaderInfo] = useState({ coach: '', assistant: '' })
  const scrollRef = useRef<HTMLDivElement>(null)

  const playerIds = useMemo(() => players.map(p => p.id), [players])
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
    Promise.all([
      getAttendanceForTurnoInRange(playerIds, TURNO, start, end),
      getAttendanceForTurnoInRange(playerIds, 'Pelota', start, end),
    ]).then(([fisico, pelota]) => {
      setFisicoRecords(fisico)
      setPelotaRecords(pelota)
      const daysWithData = Array.from(new Set(fisico.map(r => r.date))).sort()
      setExtraDays(prev => Array.from(new Set([...prev, ...daysWithData])).sort())
    })
    .catch(() => onToast({ msg: 'Error al cargar asistencia.', type: 'error' }))
    .finally(() => setLoading(false))
    setExtraDays([])
  }, [playerIds.join(','), start, end])

  const days = useMemo(() => Array.from(new Set(extraDays)).sort(), [extraDays])

  function getStatus(playerId: string, date: string): AttendanceStatus | null {
    return (fisicoRecords.find(r => r.player_id === playerId && r.date === date)?.status ?? null) as AttendanceStatus | null
  }
  function getPSE(playerId: string, date: string): number | null {
    return fisicoRecords.find(r => r.player_id === playerId && r.date === date)?.pse ?? null
  }

  async function handleSetStatus(playerId: string, date: string, status: AttendanceStatus | null) {
    try {
      if (status === null) {
        await clearAttendanceStatus(playerId, date, TURNO)
        setFisicoRecords(prev => prev.filter(r => !(r.player_id === playerId && r.date === date)))
      } else {
        await setAttendanceStatus(playerId, date, TURNO, status)
        if (status !== 'presente') await setAttendancePSE(playerId, date, TURNO, null).catch(() => {})
        setFisicoRecords(prev => {
          const existing = prev.find(r => r.player_id === playerId && r.date === date)
          if (existing) return prev.map(r => r === existing ? { ...r, status, pse: status === 'presente' ? r.pse : null } : r)
          return [...prev, { id: '', player_id: playerId, date, turno: TURNO, status, pse: null, created_at: '' }]
        })
      }
      onVersionBump()
    } catch { onToast({ msg: 'Error al guardar.', type: 'error' }) }
  }

  async function handleSetPSE(playerId: string, date: string, pse: number | null) {
    try {
      await setAttendancePSE(playerId, date, TURNO, pse)
      setFisicoRecords(prev => prev.map(r => r.player_id === playerId && r.date === date ? { ...r, pse } : r))
      onVersionBump()
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
                  <th key={d} className={clsx('px-2 py-3 text-center text-xs font-semibold text-gray-600 min-w-[72px]', d === todayKey && 'bg-blue-50')}>
                    <div data-day-col={d}>{format(new Date(d + 'T12:00'), 'd/MM')}</div>
                    <div className="text-[10px] text-gray-400">{format(new Date(d + 'T12:00'), 'EEE', { locale: es })}</div>
                    <button type="button" onClick={() => {
                      if (!confirm('¿Borrar este día?')) return
                      setFisicoRecords(prev => prev.filter(r => r.date !== d))
                      setExtraDays(prev => prev.filter(x => x !== d))
                    }} className="text-gray-200 hover:text-red-400 transition-colors mt-0.5">
                      <Trash2 size={10}/>
                    </button>
                  </th>
                ))}
                <th className="px-2 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">%</th>
                <th className="px-2 py-3 text-xs text-gray-400 uppercase tracking-wider w-8"></th>
              </tr>
            </thead>
            <tbody>
              {players.map(player => {
                const presences = days.filter(d => getStatus(player.id, d) === 'presente').length
                const total = days.filter(d => getStatus(player.id, d) !== null && getStatus(player.id, d) !== 'lesionado').length
                const pct = total > 0 ? Math.round((presences / total) * 100) : 0
                return (
                  <tr key={player.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 font-medium text-gray-800 sticky left-0 bg-white text-sm">{player.full_name}</td>
                    {days.map(d => {
                      const status = getStatus(player.id, d)
                      const pse = getPSE(player.id, d)
                      const { srpe, duration } = computeSRPE(player.id, d, fisicoRecords, pelotaRecords)
                      const isOpen = menuFor?.playerId === player.id && menuFor?.date === d
                      return (
                        <td key={d} className={clsx('px-1 py-1 border-b border-gray-50 text-center', d === todayKey && 'bg-blue-50/30')}>
                          {/* Botón de estado */}
                          <button
                            onClick={e => {
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                              setMenuFor(isOpen ? null : { playerId: player.id, date: d, x: rect.left + rect.width / 2, y: rect.bottom + 8 })
                            }}
                            className={clsx('w-9 h-7 rounded-lg text-xs font-bold transition-colors block mx-auto',
                              status ? STATUS_STYLE[status].cls : 'bg-gray-50 text-gray-300 hover:bg-gray-100')}>
                            {status ? STATUS_STYLE[status].label : '−'}
                          </button>
                          {/* PSE con colores */}
                          {status === 'presente' && (
                            <>
                              <select
                                value={pse ?? ''}
                                onChange={e => handleSetPSE(player.id, d, e.target.value ? Number(e.target.value) : null)}
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

      {/* Dropdown de estado */}
      {menuFor && (() => {
        const status = fisicoRecords.find(r => r.player_id === menuFor.playerId && r.date === menuFor.date)?.status ?? null
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} />
            <div className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-1 flex gap-1"
              style={{ left: menuFor.x, top: menuFor.y, transform: 'translateX(-50%)' }}>
              {(['presente', 'ausente', 'lesionado'] as AttendanceStatus[]).map(opt => (
                <button key={opt} onClick={() => { handleSetStatus(menuFor.playerId, menuFor.date, opt); setMenuFor(null) }}
                  className={clsx('w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center', STATUS_STYLE[opt].cls)} title={opt}>
                  {STATUS_STYLE[opt].label}
                </button>
              ))}
              {status && (
                <button onClick={() => { handleSetStatus(menuFor.playerId, menuFor.date, null); setMenuFor(null) }}
                  className="w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-gray-100" title="Limpiar">
                  <X size={13}/>
                </button>
              )}
            </div>
          </>
        )
      })()}

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
function PSEChart({ players, refMonth, refreshKey }: { players: Player[]; refMonth: Date; refreshKey: number }) {
  const [selected, setSelected] = useState('__team__')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const playerIds = useMemo(() => players.map(p => p.id), [players])
  const { start, end } = useMemo(() => getMonthRange(refMonth), [refMonth])

  useEffect(() => {
    getAttendanceForTurnoInRange(playerIds, TURNO, start, end)
      .then(setRecords)
  }, [playerIds.join(','), start, end, refreshKey])

  const relevant = records.filter(r => r.status === 'presente' && r.pse != null &&
    (selected === '__team__' || r.player_id === selected))

  const weeklyData = useMemo(() => {
    const buckets = new Map<string, { sum: number; count: number; weekStart: Date }>()
    relevant.forEach(r => {
      const day = new Date(r.date + 'T12:00:00')
      const ws = startOfWeek(day, { weekStartsOn: 1 })
      const key = format(ws, 'yyyy-MM-dd')
      const b = buckets.get(key) ?? { sum: 0, count: 0, weekStart: ws }
      b.sum += r.pse as number; b.count += 1; buckets.set(key, b)
    })
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([, b], i) => ({ label: `Sem ${i + 1}`, fullLabel: format(b.weekStart, "d 'de' MMM", { locale: es }), value: Math.round((b.sum / b.count) * 10) / 10 }))
  }, [relevant])

  if (weeklyData.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <p className="text-sm font-semibold text-gray-800">PSE semanal promedio</p>
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 text-gray-700 focus:outline-none">
          <option value="__team__">Equipo</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" vertical={false}/>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false}/>
            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#898781' }} axisLine={false} tickLine={false}/>
            <Tooltip formatter={(v: number) => [v, 'PSE prom.']} labelFormatter={(l: string) => weeklyData.find(d => d.label === l)?.fullLabel ?? l}/>
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {weeklyData.map((d, i) => <Cell key={i} fill={pseChartColor(d.value)}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#639922]"/>1-5 bajo</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]"/>6 medio-bajo</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f97316]"/>7-8 medio-alto</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#e34948]"/>9-10 alto</span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// GRÁFICO DE sRPE SEMANAL (Carga de entrenamiento)
// ════════════════════════════════════════════════════════════════════════════
function SRPEChart({ players, refMonth, refreshKey }: { players: Player[]; refMonth: Date; refreshKey: number }) {
  const [selected, setSelected] = useState('__team__')
  const [fisicoRecords, setFisicoRecords] = useState<AttendanceRecord[]>([])
  const [pelotaRecords, setPelotaRecords] = useState<AttendanceRecord[]>([])
  const playerIds = useMemo(() => players.map(p => p.id), [players])
  const { start, end } = useMemo(() => getMonthRange(refMonth), [refMonth])

  useEffect(() => {
    Promise.all([
      getAttendanceForTurnoInRange(playerIds, TURNO, start, end),
      getAttendanceForTurnoInRange(playerIds, 'Pelota', start, end),
    ]).then(([f, p]) => { setFisicoRecords(f); setPelotaRecords(p) })
  }, [playerIds.join(','), start, end, refreshKey])

  const relevantPlayers = selected === '__team__' ? players : players.filter(p => p.id === selected)
  const allDates = useMemo(() => Array.from(new Set(fisicoRecords.map(r => r.date))).sort(), [fisicoRecords])

  const weeklyData = useMemo(() => {
    const buckets = new Map<string, { sum: number; count: number; weekStart: Date }>()
    allDates.forEach(date => {
      relevantPlayers.forEach(player => {
        const { srpe } = computeSRPE(player.id, date, fisicoRecords, pelotaRecords)
        if (srpe === 0) return
        const day = new Date(date + 'T12:00:00')
        const ws = startOfWeek(day, { weekStartsOn: 1 })
        const key = format(ws, 'yyyy-MM-dd')
        const b = buckets.get(key) ?? { sum: 0, count: 0, weekStart: ws }
        b.sum += srpe; b.count += 1; buckets.set(key, b)
      })
    })
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([, b], i) => ({
        label: `Sem ${i + 1}`,
        fullLabel: format(b.weekStart, "d 'de' MMM", { locale: es }),
        value: Math.round(b.sum / b.count),
      }))
  }, [allDates, relevantPlayers, fisicoRecords, pelotaRecords])

  if (weeklyData.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Carga semanal (sRPE)</p>
          <p className="text-xs text-gray-400 mt-0.5">PSE × duración de entrenamiento</p>
        </div>
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 text-gray-700 focus:outline-none">
          <option value="__team__">Equipo (promedio)</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" vertical={false}/>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: '#898781' }} axisLine={false} tickLine={false}/>
            <Tooltip formatter={(v: number) => [v, 'sRPE prom.']} labelFormatter={(l: string) => weeklyData.find(d => d.label === l)?.fullLabel ?? l}/>
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} fill="#3b82f6">
              {weeklyData.map((d, i) => {
                const color = d.value < 400 ? '#639922' : d.value < 700 ? '#f59e0b' : d.value < 900 ? '#f97316' : '#e34948'
                return <Cell key={i} fill={color}/>
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#639922]"/>&lt;400 baja</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]"/>400-699 moderada</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f97316]"/>700-899 alta</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#e34948]"/>≥900 muy alta</span>
      </div>
    </div>
  )
}
