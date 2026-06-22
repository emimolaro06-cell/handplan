import { useState, useEffect, useMemo } from 'react'
import {
  Plus, X, UserPlus, Trash2, ChevronLeft, ChevronRight,
  Check, Calendar, BarChart3,
} from 'lucide-react'
import { format, addDays, subDays, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button, Toast, Card, Empty } from '@/components/ui/index'
import {
  listPlayers, addPlayer, deletePlayer,
  getAttendanceForDate, setAttendance, getAttendanceInRange,
  computeAttendanceSummary, getMonthRange,
} from '@/lib/attendance'
import type { Player, AttendanceRecord, TeamCategory } from '@/types'

type Tab = 'marcar' | 'resumen'

export function AttendancePage() {
  const { profile, effectiveUserId, selectedCategory } = useAppStore()
  const category = selectedCategory as TeamCategory

  const [tab, setTab] = useState<Tab>('marcar')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')

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
      const created = await addPlayer(effectiveUserId, category, newPlayerName.trim())
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Asistencia</h1>
          <p className="text-gray-500 text-sm mt-0.5">{category}</p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTab('marcar')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
              tab === 'marcar' ? 'bg-white shadow-sm text-dj-700' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Calendar size={14}/> Marcar
          </button>
          <button
            onClick={() => setTab('resumen')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
              tab === 'resumen' ? 'bg-white shadow-sm text-dj-700' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <BarChart3 size={14}/> Resumen
          </button>
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
          {tab === 'marcar' && (
            <MarkAttendanceView
              players={players}
              onToast={setToast}
              onAddPlayerClick={() => setShowAddPlayer(true)}
              onDeletePlayer={handleDeletePlayer}
            />
          )}
          {tab === 'resumen' && <SummaryView players={players}/>}
        </>
      )}

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
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
              />
              <Button className="w-full" disabled={!newPlayerName.trim()} onClick={handleAddPlayer}>
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
// VISTA: MARCAR ASISTENCIA POR FECHA
// ════════════════════════════════════════════════════════════════════════════
function MarkAttendanceView({ players, onToast, onAddPlayerClick, onDeletePlayer }: {
  players: Player[]
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
  onAddPlayerClick: () => void
  onDeletePlayer: (id: string) => void
}) {
  const [date, setDate] = useState(new Date())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const dateKey = format(date, 'yyyy-MM-dd')
  const playerIds = useMemo(() => players.map(p => p.id), [players])

  useEffect(() => {
    setLoading(true)
    getAttendanceForDate(playerIds, dateKey)
      .then(setRecords)
      .catch(() => onToast({ msg: 'Error al cargar la asistencia.', type: 'error' }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, playerIds.join(',')])

  function getStatus(playerId: string): boolean | null {
    const rec = records.find(r => r.player_id === playerId)
    return rec ? rec.present : null
  }

  async function handleMark(playerId: string, present: boolean) {
    setSaving(playerId)
    try {
      await setAttendance(playerId, dateKey, present)
      setRecords(prev => {
        const existing = prev.find(r => r.player_id === playerId)
        if (existing) return prev.map(r => (r.player_id === playerId ? { ...r, present } : r))
        return [...prev, { id: '', player_id: playerId, date: dateKey, present, created_at: '' }]
      })
    } catch {
      onToast({ msg: 'Error al guardar.', type: 'error' })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 bg-dj-800 rounded-xl px-3 py-2">
          <button onClick={() => setDate(d => subDays(d, 1))} className="text-white/60 hover:text-white">
            <ChevronLeft size={18}/>
          </button>
          <p className="text-white font-bold text-sm capitalize min-w-40 text-center">
            {format(date, "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <button onClick={() => setDate(d => addDays(d, 1))} className="text-white/60 hover:text-white">
            <ChevronRight size={18}/>
          </button>
        </div>
        <Button variant="secondary" size="sm" icon={<UserPlus size={15}/>} onClick={onAddPlayerClick}>
          Agregar jugador
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Cargando...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {players.map(player => {
            const status = getStatus(player.id)
            return (
              <div key={player.id} className="flex items-center justify-between px-4 py-3 group">
                <p className="text-sm font-medium text-gray-800">{player.full_name}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMark(player.id, true)}
                    disabled={saving === player.id}
                    className={clsx(
                      'px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1',
                      status === true ? 'bg-dj-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-dj-50 hover:text-dj-600',
                    )}
                  >
                    <Check size={12}/> Presente
                  </button>
                  <button
                    onClick={() => handleMark(player.id, false)}
                    disabled={saving === player.id}
                    className={clsx(
                      'px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1',
                      status === false ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500',
                    )}
                  >
                    <X size={12}/> Ausente
                  </button>
                  <button
                    onClick={() => onDeletePlayer(player.id)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// VISTA: RESUMEN DE ASISTENCIA (porcentajes)
// ════════════════════════════════════════════════════════════════════════════
function SummaryView({ players }: { players: Player[] }) {
  const [refMonth, setRefMonth] = useState(new Date())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeMode, setRangeMode] = useState<'month' | 'season'>('month')

  const playerIds = useMemo(() => players.map(p => p.id), [players])

  useEffect(() => {
    setLoading(true)
    const range = rangeMode === 'month'
      ? getMonthRange(refMonth)
      : { start: '2000-01-01', end: '2100-01-01' }
    getAttendanceInRange(playerIds, range.start, range.end)
      .then(setRecords)
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refMonth, rangeMode, playerIds.join(',')])

  const summary = useMemo(() => computeAttendanceSummary(players, records), [players, records])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setRangeMode('month')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
              rangeMode === 'month' ? 'bg-white shadow-sm text-dj-700' : 'text-gray-500',
            )}
          >
            Mes
          </button>
          <button
            onClick={() => setRangeMode('season')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
              rangeMode === 'season' ? 'bg-white shadow-sm text-dj-700' : 'text-gray-500',
            )}
          >
            Toda la temporada
          </button>
        </div>

        {rangeMode === 'month' && (
          <div className="flex items-center gap-2 bg-dj-800 rounded-xl px-3 py-1.5">
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
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Cargando...</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {summary.map(s => (
            <div key={s.player.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{s.player.full_name}</p>
                <p className="text-xs text-gray-400">
                  {s.presentDays} de {s.totalDays} registrad{s.totalDays === 1 ? 'o' : 'os'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full',
                      s.percentage >= 80 ? 'bg-dj-600' : s.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500',
                    )}
                    style={{ width: `${s.percentage}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-700 w-10 text-right">{s.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
