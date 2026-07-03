import { clsx } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import {
  PlusCircle, BookOpen, CalendarDays, UserCheck,
  Layers, Activity, X, Sparkles, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { getSessions, supabase } from '@/lib/supabase'
import { TEAM_CATEGORY_BG, TEAM_CATEGORY_STYLES } from '@/lib/constants'
import type { TrainingSession, TeamCategory } from '@/types'
import {
  format, startOfMonth, endOfMonth, startOfYear,
  differenceInDays, getMonth,
} from 'date-fns'
import { es } from 'date-fns/locale'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

const QUICK_ACTIONS = [
  { to: '/pizarra',            icon: Layers,       label: 'Pizarra',       desc: 'Jugadas animadas'   },
  { to: '/planificacion',      icon: CalendarDays, label: 'Planificación', desc: 'Calendario mensual' },
  { to: '/asistencia',         icon: UserCheck,    label: 'Asistencia',    desc: 'Marcar presentes'   },
  { to: '/preparacion-fisica', icon: Activity,     label: 'Físico',        desc: 'PSE y carga'        },
]

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface ProfileOption {
  id: string
  full_name: string
  username: string
  avatar_color: string | null
  role: string
}

export function MenuPage() {
  const navigate = useNavigate()
  const { profile, account, effectiveUserId, selectedCategory, setSelectedCategory } = useAppStore()
  const now = useClock()

  const [monthCount, setMonthCount]     = useState(0)
  const [yearCount, setYearCount]       = useState(0)
  const [monthlyData, setMonthlyData]   = useState<number[]>(Array(12).fill(0))
  const [daysSinceLast, setDaysSinceLast] = useState<number | null>(null)
  const [noSessionsWeek, setNoSessionsWeek] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [profiles, setProfiles]         = useState<ProfileOption[]>([])

  // Cargar sesiones
  useEffect(() => {
    if (!effectiveUserId) return
    setLoading(true)
    const today = new Date()
    getSessions(effectiveUserId, { team_category: selectedCategory ?? undefined })
      .then(({ data }) => {
        const sessions = (data as TrainingSession[]) ?? []
        const lastSession = sessions[0]
        if (lastSession) {
          const diff = differenceInDays(today, new Date(lastSession.session_date))
          setDaysSinceLast(diff)
          setNoSessionsWeek(diff >= 7)
        } else {
          setNoSessionsWeek(true)
        }
        const monthSessions = sessions.filter(s => {
          const d = new Date(s.session_date)
          return d >= startOfMonth(today) && d <= endOfMonth(today)
        })
        setMonthCount(monthSessions.length)
        const yearSessions = sessions.filter(s => new Date(s.session_date) >= startOfYear(today))
        setYearCount(yearSessions.length)
        const byMonth = Array(12).fill(0)
        yearSessions.forEach(s => { byMonth[getMonth(new Date(s.session_date))]++ })
        setMonthlyData(byMonth)
      })
      .finally(() => setLoading(false))
  }, [effectiveUserId, selectedCategory])

  // Cargar perfiles del mismo club
  useEffect(() => {
    if (!account?.id) return
    supabase
      .from('profiles')
      .select('id, full_name, username, avatar_color, role')
      .eq('account_id', account.id)
      .neq('role', 'admin')
      .order('full_name')
      .then(({ data }) => { if (data) setProfiles(data as ProfileOption[]) })
  }, [account?.id])

  const CURRENT_VERSION = 'v1.2'
  const [showNews, setShowNews] = useState(false)
  useEffect(() => {
    if (localStorage.getItem('handplan_news_seen') !== CURRENT_VERSION) setShowNews(true)
  }, [])
  function closeNews() {
    localStorage.setItem('handplan_news_seen', CURRENT_VERSION)
    setShowNews(false)
  }

  const color       = account?.primary_color || '#1e8a1e'
  const logoUrl     = account?.logo_url || '/logo-handplan.svg'
  const accountName = account?.name || 'HandPlan'
  const catStyle    = selectedCategory ? TEAM_CATEGORY_STYLES[selectedCategory] : null
  const categories  = profile?.categories ?? []
  const maxBar      = Math.max(...monthlyData, 1)
  const currentMonth = getMonth(now)
  const clockStr    = format(now, 'HH:mm')
  const dateStr     = format(now, "EEE d MMM yyyy", { locale: es })

  function handleSelectCategory(cat: TeamCategory) {
    setSelectedCategory(cat)
  }

  if (!profile) return null

  return (
    <>
      <div className="min-h-screen bg-gray-50">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <div className="px-5 pt-7 pb-14 relative overflow-hidden"
          style={{ backgroundColor: color }}>
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-[0.06]"
            style={{ backgroundColor: 'white' }}/>
          <div className="absolute right-6 bottom-0 w-24 h-24 rounded-full opacity-[0.04]"
            style={{ backgroundColor: 'white' }}/>

          <div className="max-w-5xl mx-auto relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-6">
                <img src={logoUrl} alt={accountName} className="w-7 h-7 object-contain"/>
                <div>
                  <p className="text-white/90 text-[11px] font-bold uppercase tracking-widest leading-tight">{accountName}</p>
                  <p className="text-white/40 text-[10px] leading-tight">{profile.full_name}</p>
                </div>
              </div>
              <p className="text-white/55 text-xs mb-0.5">{greeting()},</p>
              <h1 className="text-2xl font-bold text-white mb-3 leading-tight">
                {profile.full_name?.split(' ')[0] ?? 'Profe'}
              </h1>
              {selectedCategory && (
                <div className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold',
                  catStyle?.bg, catStyle?.text,
                )}>
                  <span className={clsx('w-1.5 h-1.5 rounded-full', TEAM_CATEGORY_BG[selectedCategory])}/>
                  {selectedCategory}
                </div>
              )}
            </div>
            {/* Reloj */}
            <div className="text-right bg-black/20 rounded-xl px-3 py-2 flex-shrink-0">
              <p className="text-white text-lg font-medium leading-none tracking-wide">{clockStr}</p>
              <p className="text-white/45 text-[10px] mt-1 leading-none capitalize">{dateStr}</p>
            </div>
          </div>
        </div>

        {/* ── CARRUSEL DE PERFILES ─────────────────────────────── */}
        {profiles.length > 1 && (
          <div className="border-b border-gray-100 bg-white">
            <div className="max-w-5xl mx-auto px-5 py-2 flex items-center gap-2 overflow-x-auto">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider flex-shrink-0 mr-1">Perfil</p>
              {profiles.map(p => {
                const isMe = p.id === profile.id
                return (
                  <button key={p.id} type="button"
                    onClick={() => !isMe && navigate('/perfiles')}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0',
                      isMe
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                    )}>
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: p.avatar_color ?? color }}>
                      {p.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    {p.full_name.split(' ')[0]}
                  </button>
                )
              })}
              <button type="button" onClick={() => navigate('/perfiles')}
                className="flex-shrink-0 text-[11px] text-gray-400 hover:text-gray-600 transition-colors ml-1">
                Cambiar →
              </button>
            </div>
          </div>
        )}

        {/* ── SELECTOR DE CATEGORÍA (inline si no hay ninguna) ─── */}
        {!selectedCategory && categories.length > 0 && (
          <div className="max-w-5xl mx-auto px-5 pt-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-800 mb-1">Seleccioná tu categoría</p>
              <p className="text-xs text-gray-400 mb-4">Para ver el dashboard y acceder a la app</p>
              <div className="flex flex-col gap-2">
                {categories.map(cat => (
                  <button key={cat} type="button"
                    onClick={() => handleSelectCategory(cat as TeamCategory)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 hover:border-gray-200 transition-all text-left">
                    <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0', TEAM_CATEGORY_BG[cat as TeamCategory])}>
                      {cat.slice(0, 3).toUpperCase()}
                    </div>
                    <p className="font-semibold text-gray-800 text-sm flex-1">{cat}</p>
                    <ChevronRight size={16} className="text-gray-300"/>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DASHBOARD (solo cuando hay categoría seleccionada) ── */}
        {selectedCategory && (
          <div className="max-w-5xl mx-auto px-5 -mt-6 pb-10">
            <div className="grid grid-cols-2 gap-4 items-start">

              {/* COLUMNA IZQUIERDA */}
              <div className="flex flex-col gap-4">

                {/* Alerta */}
                {!loading && noSessionsWeek && (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-xs font-semibold text-amber-800">Sin entrenamientos esta semana</p>
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        {daysSinceLast !== null
                          ? `Última sesión hace ${daysSinceLast} día${daysSinceLast !== 1 ? 's' : ''}`
                          : 'No hay sesiones registradas aún'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Botones principales */}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => navigate('/crear')}
                    className="flex flex-col gap-3 bg-amber-400 hover:bg-amber-500 rounded-2xl p-4 text-left transition-all active:scale-[0.97]">
                    <div className="w-9 h-9 rounded-xl bg-black/10 flex items-center justify-center">
                      <PlusCircle size={20} className="text-gray-900"/>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm leading-tight">Crear entrenamiento</p>
                      <p className="text-gray-800/50 text-xs mt-0.5">Nuevo plan</p>
                    </div>
                  </button>

                  <button type="button" onClick={() => navigate('/biblioteca')}
                    className="flex flex-col gap-3 rounded-2xl p-4 text-left transition-all active:scale-[0.97]"
                    style={{ backgroundColor: color }}>
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                      <BookOpen size={20} className="text-white"/>
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm leading-tight">Biblioteca</p>
                      <p className="text-white/50 text-xs mt-0.5">Entrenamientos</p>
                    </div>
                  </button>
                </div>

                {/* Accesos rápidos */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                    Accesos rápidos
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc }) => (
                      <button key={to} type="button" onClick={() => navigate(to)}
                        className="flex items-center gap-2.5 bg-white rounded-xl p-3 text-left border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all active:scale-[0.98]">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                          <Icon size={15} className="text-gray-500"/>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{label}</p>
                          <p className="text-[10px] text-gray-400 truncate">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA */}
              <div className="flex flex-col gap-4">

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Este mes</p>
                    <p className="text-2xl font-bold text-gray-900 leading-none">{monthCount}</p>
                    <p className="text-[11px] text-gray-400 mt-1">sesion{monthCount !== 1 ? 'es' : ''}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Temporada</p>
                    <p className="text-2xl font-bold text-gray-900 leading-none">{yearCount}</p>
                    <p className="text-[11px] text-gray-400 mt-1">sesiones totales</p>
                  </div>
                </div>

                {/* Gráfico */}
                {yearCount > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 px-4 pt-3 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-700">Sesiones por mes</p>
                      <p className="text-[10px] text-gray-400">Temporada {now.getFullYear()}</p>
                    </div>
                    <div className="flex items-end gap-1" style={{ height: 64 }}>
                      {monthlyData.map((count, i) => {
                        const h = count === 0 ? 2 : Math.max(Math.round((count / maxBar) * 64), 4)
                        const isCurrent = i === currentMonth
                        return (
                          <div key={i} className="flex-1 rounded-sm transition-all"
                            style={{
                              height: h,
                              backgroundColor: isCurrent ? color : `${color}45`,
                              minHeight: 2,
                            }}
                          />
                        )
                      })}
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      {MONTH_LABELS.map((l, i) => (
                        <div key={i} className={clsx('flex-1 text-center text-[8px]',
                          i === currentMonth ? 'font-bold text-gray-600' : 'text-gray-300')}>
                          {l}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL NOVEDADES ──────────────────────────────────────── */}
      {showNews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-5 pb-4 flex items-start justify-between" style={{ backgroundColor: color }}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-white/80"/>
                <div>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Novedades</p>
                  <p className="text-white font-bold text-base leading-tight">HandPlan se actualizó</p>
                </div>
              </div>
              <button type="button" onClick={closeNews} className="text-white/50 hover:text-white transition-colors">
                <X size={16}/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                { emoji: '🎬', title: 'Pizarra animada', desc: 'Creá jugadas por fotogramas y exportalas como MP4.' },
                { emoji: '📁', title: 'Carpetas de ejercicios', desc: 'Organizá tu biblioteca en carpetas.' },
                { emoji: '💪', title: 'Preparadores físicos', desc: 'Asistencia, PSE y carga con estadísticas.' },
              ].map(({ emoji, title, desc }) => (
                <div key={title} className="flex gap-3">
                  <span className="text-lg flex-shrink-0">{emoji}</span>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5">
              <button type="button" onClick={closeNews}
                className="w-full py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: color }}>
                Entendido, vamos
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
