import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, BarChart2, Edit2, Save, X, ChevronDown, ChevronUp,
  Calendar, TrendingUp, Award, BookOpen, MessageSquare, Send, Trash2,
} from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { clsx } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { Card, Spinner, Toast, Badge } from '@/components/ui/index'
import { TEAM_CATEGORIES, CONTENT_CATEGORIES, TEAM_CATEGORY_STYLES } from '@/lib/constants'
import { listTrainingComments, addTrainingComment, deleteTrainingComment } from '@/lib/comments'
import type { Profile, TeamCategory, ContentCategory, TrainingComment } from '@/types'

interface SessionRow {
  id: string
  coach_name: string
  team_category: string
  content_category: string
  session_date: string
  user_id: string
}

interface StatsData {
  totalSessions: number
  byContent: Record<string, number>
  byCategory: Record<string, number>
  byCoach: Record<string, number>
  byMonth: Record<string, number>
}

export function AdminPage() {
  const navigate = useNavigate()
  const { profile } = useAppStore()
  const [tab, setTab] = useState<'coaches' | 'stats'>('coaches')
  const [coaches, setCoaches] = useState<Profile[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCats, setEditCats] = useState<TeamCategory[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [statsRange, setStatsRange] = useState<'month' | 'year'>('month')

  // Modal de comentarios sobre un entrenamiento puntual
  const [commentingSession, setCommentingSession] = useState<SessionRow | null>(null)

  useEffect(() => {
    if (profile?.role !== 'admin') { navigate('/menu'); return }
    loadData()
  }, [profile])

  async function loadData() {
    setLoading(true)
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('training_sessions').select('id,coach_name,team_category,content_category,session_date,user_id,status').eq('status', 'saved'),
    ])
    setCoaches((c as Profile[]) ?? [])
    setSessions((s as SessionRow[]) ?? [])
    setLoading(false)
  }

  // ─── Editar categorías ────────────────────────────────────────────────────
  function startEdit(coach: Profile) {
    setEditingId(coach.id)
    setEditCats(coach.categories ?? [])
  }

  function toggleCat(cat: TeamCategory) {
    setEditCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  async function saveEdit(id: string) {
    const { error } = await supabase.from('profiles').update({ categories: editCats }).eq('id', id)
    if (error) { setToast({ msg: 'Error al guardar.', type: 'error' }); return }
    setCoaches(prev => prev.map(c => c.id === id ? { ...c, categories: editCats } : c))
    setEditingId(null)
    setToast({ msg: 'Categorías actualizadas.', type: 'success' })
  }

  // ─── Estadísticas ─────────────────────────────────────────────────────────
  function computeStats(): StatsData {
    const now = new Date()
    const filtered = sessions.filter(s => {
      const d = new Date(s.session_date)
      if (statsRange === 'month') {
        const start = startOfMonth(now), end = endOfMonth(now)
        return d >= start && d <= end
      }
      return d >= new Date(now.getFullYear(), 0, 1)
    })

    const byContent: Record<string, number> = {}
    const byCategory: Record<string, number> = {}
    const byCoach: Record<string, number> = {}
    const byMonth: Record<string, number> = {}

    filtered.forEach(s => {
      byContent[s.content_category] = (byContent[s.content_category] ?? 0) + 1
      byCategory[s.team_category]   = (byCategory[s.team_category]   ?? 0) + 1
      byCoach[s.coach_name]         = (byCoach[s.coach_name]         ?? 0) + 1
      const m = format(new Date(s.session_date), 'MMM', { locale: es })
      byMonth[m] = (byMonth[m] ?? 0) + 1
    })

    return { totalSessions: filtered.length, byContent, byCategory, byCoach, byMonth }
  }

  const stats = computeStats()
  const maxContent  = Math.max(...Object.values(stats.byContent), 1)
  const maxCategory = Math.max(...Object.values(stats.byCategory), 1)
  const maxCoach    = Math.max(...Object.values(stats.byCoach), 1)

  const baseCats = ['Minis', 'Infantiles', 'Menores', 'Cadetes', 'Juveniles', 'Primera']

  const CONTENT_COLORS: Record<string, string> = {
    'Técnica individual OFENSIVA':  'bg-dj-500',
    'Técnica individual DEFENSIVA': 'bg-blue-500',
    'Táctica OFENSIVA':  'bg-amber-500',
    'Táctica DEFENSIVA': 'bg-purple-500',
    'MIXTO': 'bg-gray-500',
  }

  if (loading) return (
    <div className="flex justify-center items-center py-24"><Spinner size={36}/></div>
  )

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Panel de administrador</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gestión de entrenadores y estadísticas del club</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'coaches', label: 'Entrenadores', icon: Users },
          { id: 'stats',   label: 'Estadísticas', icon: BarChart2 },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === id ? 'border-dj-600 text-dj-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            <Icon size={16}/>{label}
          </button>
        ))}
      </div>

      {/* ── TAB: Entrenadores ─────────────────────────────────────────────── */}
      {tab === 'coaches' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{coaches.length} perfiles registrados</p>
          {coaches.map(coach => {
            const isEditing = editingId === coach.id
            const coachSessions = sessions.filter(s => s.user_id === coach.id)

            return (
              <Card key={coach.id} padded={false} className="overflow-hidden">
                {/* Header del coach */}
                <div className="flex items-center gap-4 p-4">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: coach.avatar_color ?? '#1e8a1e' }}>
                    {coach.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{coach.full_name}</p>
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        coach.role === 'admin' ? 'bg-gold-100 text-gold-800' : 'bg-gray-100 text-gray-600'
                      )}>
                        {coach.role === 'admin' ? '👑 Admin' : 'Entrenador'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">@{coach.username} · {coachSessions.length} entrenamientos</p>
                  </div>
                  <button onClick={() => isEditing ? setEditingId(null) : startEdit(coach)}
                    className="text-gray-400 hover:text-dj-600 p-2 rounded-xl hover:bg-dj-50 transition-colors">
                    {isEditing ? <X size={16}/> : <Edit2 size={16}/>}
                  </button>
                </div>

                {/* Categorías actuales */}
                {!isEditing && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {(coach.categories ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Sin categorías asignadas</p>
                    ) : (coach.categories ?? []).map(cat => {
                      const style = TEAM_CATEGORY_STYLES[cat as TeamCategory] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
                      return (
                        <span key={cat} className={clsx('text-xs px-2.5 py-1 rounded-full font-medium', style.bg, style.text)}>
                          {cat}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Editor de categorías */}
                {isEditing && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">Editar categorías:</p>
                    <div className="space-y-1.5 mb-3">
                      {baseCats.map(base => (
                        <div key={base} className="flex gap-1.5">
                          {(['A', 'B'] as const).map(letra => {
                            const cat = `${base} ${letra}` as TeamCategory
                            const sel = editCats.includes(cat)
                            return (
                              <button key={cat} type="button" onClick={() => toggleCat(cat)}
                                className={clsx(
                                  'flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all',
                                  sel ? 'bg-dj-600 border-dj-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-dj-300'
                                )}>
                                {cat} {sel && <span>✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => saveEdit(coach.id)}
                      className="flex items-center gap-1.5 bg-dj-600 hover:bg-dj-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
                      <Save size={13}/> Guardar cambios
                    </button>
                  </div>
                )}

                {/* Entrenamientos recientes del coach */}
                {!isEditing && coachSessions.length > 0 && (
                  <div className="px-4 pb-3 border-t border-gray-50 pt-2">
                    <p className="text-xs text-gray-400 mb-1.5">Últimos entrenamientos (click para comentar):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {coachSessions.slice(0, 5).map(s => (
                        <button
                          key={s.id}
                          onClick={() => setCommentingSession(s)}
                          className="text-xs bg-gray-50 hover:bg-gold-50 hover:border-gold-300 text-gray-600 px-2 py-1 rounded-lg border border-gray-100 transition-colors flex items-center gap-1"
                        >
                          <MessageSquare size={11} className="text-gray-400"/>
                          {s.team_category} · {format(new Date(s.session_date), 'd MMM', { locale: es })}
                        </button>
                      ))}
                      {coachSessions.length > 5 && (
                        <span className="text-xs text-gray-400">+{coachSessions.length - 5} más</span>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── TAB: Estadísticas ────────────────────────────────────────────── */}
      {tab === 'stats' && (
        <div className="space-y-6">
          {/* Selector de rango */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
              {[
                { id: 'month', label: 'Este mes' },
                { id: 'year',  label: 'Este año' },
              ].map(r => (
                <button key={r.id} onClick={() => setStatsRange(r.id as typeof statsRange)}
                  className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    statsRange === r.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar size={15}/>
              <span className="font-semibold text-gray-900">{stats.totalSessions}</span> entrenamientos
            </div>
          </div>

          {/* Contenido más usado */}
          <Card>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-dj-600"/>
              Contenido más trabajado
            </h3>
            {Object.keys(stats.byContent).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin datos en este período</p>
            ) : (
              <div className="space-y-3">
                {CONTENT_CATEGORIES
                  .filter(c => stats.byContent[c] > 0)
                  .sort((a, b) => (stats.byContent[b] ?? 0) - (stats.byContent[a] ?? 0))
                  .map(c => {
                    const count = stats.byContent[c] ?? 0
                    const pct   = Math.round((count / maxContent) * 100)
                    return (
                      <div key={c}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{c}</span>
                          <span className="text-gray-500 font-semibold">{count}</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={clsx('h-full rounded-full transition-all', CONTENT_COLORS[c] ?? 'bg-gray-400')}
                            style={{ width: `${pct}%` }}/>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </Card>

          {/* Por categoría */}
          <Card>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award size={18} className="text-dj-600"/>
              Entrenamientos por categoría
            </h3>
            {Object.keys(stats.byCategory).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin datos en este período</p>
            ) : (
              <div className="space-y-3">
                {TEAM_CATEGORIES
                  .filter(c => stats.byCategory[c] > 0)
                  .sort((a, b) => (stats.byCategory[b] ?? 0) - (stats.byCategory[a] ?? 0))
                  .map(c => {
                    const count = stats.byCategory[c] ?? 0
                    const pct   = Math.round((count / maxCategory) * 100)
                    const style = TEAM_CATEGORY_STYLES[c] ?? { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' }
                    return (
                      <div key={c}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <div className="flex items-center gap-2">
                            <span className={clsx('w-2.5 h-2.5 rounded-full', style.dot)}/>
                            <span className="text-gray-700 font-medium">{c}</span>
                          </div>
                          <span className="text-gray-500 font-semibold">{count}</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={clsx('h-full rounded-full transition-all', style.dot)}
                            style={{ width: `${pct}%` }}/>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </Card>

          {/* Por entrenador */}
          <Card>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={18} className="text-dj-600"/>
              Actividad por entrenador
            </h3>
            {Object.keys(stats.byCoach).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin datos en este período</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.byCoach)
                  .sort((a, b) => b[1] - a[1])
                  .map(([coach, count]) => {
                    const pct = Math.round((count / maxCoach) * 100)
                    return (
                      <div key={coach}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{coach}</span>
                          <span className="text-gray-500 font-semibold">{count} sesiones</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-dj-500 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </Card>
        </div>
      )}

      {commentingSession && (
        <CommentModal
          session={commentingSession}
          adminId={profile?.id ?? ''}
          onClose={() => setCommentingSession(null)}
          onToast={setToast}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL DE COMENTARIOS — hilo de feedback del coordinador sobre un entrenamiento
// ════════════════════════════════════════════════════════════════════════════
function CommentModal({ session, adminId, onClose, onToast }: {
  session: SessionRow
  adminId: string
  onClose: () => void
  onToast: (t: { msg: string; type: 'success' | 'error' }) => void
}) {
  const [comments, setComments] = useState<TrainingComment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    listTrainingComments(session.id)
      .then(setComments)
      .catch(() => onToast({ msg: 'Error al cargar comentarios.', type: 'error' }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  async function handleSend() {
    if (!newComment.trim()) return
    setSending(true)
    try {
      const created = await addTrainingComment(session.id, adminId, newComment.trim())
      setComments(prev => [...prev, created])
      setNewComment('')
      onToast({ msg: 'Comentario agregado.', type: 'success' })
    } catch {
      onToast({ msg: 'Error al agregar el comentario.', type: 'error' })
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTrainingComment(id)
      setComments(prev => prev.filter(c => c.id !== id))
      onToast({ msg: 'Comentario eliminado.', type: 'success' })
    } catch {
      onToast({ msg: 'Error al eliminar.', type: 'error' })
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Comentarios del coordinador</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {session.team_category} · {format(new Date(session.session_date), 'd MMM yyyy', { locale: es })} · {session.coach_name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Todavía no hay comentarios en este entrenamiento.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="bg-gold-50 rounded-xl border border-gold-100 p-3 group relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gold-700">{c.admin_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {format(new Date(c.created_at), "d MMM, HH:mm", { locale: es })}
                    </span>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-700">{c.comment}</p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-100 p-4 flex gap-2">
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Escribí un comentario de feedback para el entrenador..."
            rows={2}
            className="flex-1 text-sm rounded-xl border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-dj-400"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newComment.trim()}
            className="shrink-0 bg-dj-600 hover:bg-dj-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 transition-colors flex items-center justify-center"
          >
            <Send size={16}/>
          </button>
        </div>
      </div>
    </div>
  )
}
