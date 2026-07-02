import { clsx } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import {
  PlusCircle, BookOpen, ChevronRight, CalendarDays,
  UserCheck, Layers, Activity, X, Sparkles, TrendingUp,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { getSessions } from '@/lib/supabase'
import { TEAM_CATEGORY_BG, TEAM_CATEGORY_STYLES } from '@/lib/constants'
import type { TrainingSession } from '@/types'
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const QUICK_ACTIONS = [
  { to: '/pizarra',          icon: Layers,      label: 'Pizarra',         desc: 'Jugadas animadas'      },
  { to: '/planificacion',    icon: CalendarDays, label: 'Planificación',  desc: 'Calendario mensual'    },
  { to: '/asistencia',       icon: UserCheck,   label: 'Asistencia',      desc: 'Marcar presentes'      },
  { to: '/preparacion-fisica', icon: Activity,  label: 'Físico',          desc: 'PSE y carga'           },
]

export function MenuPage() {
  const navigate = useNavigate()
  const { profile, account, effectiveUserId, selectedCategory } = useAppStore()
  const [recent, setRecent] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [monthCount, setMonthCount] = useState(0)

  useEffect(() => {
    if (!effectiveUserId) return
    getSessions(effectiveUserId, { team_category: selectedCategory ?? undefined })
      .then(({ data }) => {
        const sessions = (data as TrainingSession[]) ?? []
        const now = new Date()
        const monthSessions = sessions.filter(s => {
          const d = new Date(s.session_date)
          return d >= startOfMonth(now) && d <= endOfMonth(now)
        })
        setMonthCount(monthSessions.length)
        setRecent(sessions.slice(0, 3))
        setLoading(false)
      })
  }, [effectiveUserId, selectedCategory])

  const CURRENT_VERSION = 'v1.2'
  const [showNews, setShowNews] = useState(false)
  useEffect(() => {
    if (localStorage.getItem('handplan_news_seen') !== CURRENT_VERSION) setShowNews(true)
  }, [])
  function closeNews() {
    localStorage.setItem('handplan_news_seen', CURRENT_VERSION)
    setShowNews(false)
  }

  const color = account?.primary_color || '#1e8a1e'
  const logoUrl = account?.logo_url || '/logo-handplan.svg'
  const accountName = account?.name || 'HandPlan'
  const catStyle = selectedCategory ? TEAM_CATEGORY_STYLES[selectedCategory] : null

  const daysSinceLast = recent[0]
    ? differenceInDays(new Date(), new Date(recent[0].session_date))
    : null

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Hero */}
        <div className="px-6 pt-10 pb-20 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}>
          {/* Decoración geométrica sutil */}
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-10"
            style={{ backgroundColor: 'white' }}/>
          <div className="absolute -right-4 bottom-0 w-32 h-32 rounded-full opacity-5"
            style={{ backgroundColor: 'white' }}/>

          <div className="max-w-lg mx-auto relative">
            <div className="flex items-center gap-3 mb-8">
              <img src={logoUrl} alt={accountName} className="w-9 h-9 object-contain drop-shadow"/>
              <div>
                <p className="text-white/90 text-xs font-bold uppercase tracking-widest">{accountName}</p>
                <p className="text-white/50 text-[11px]">{profile?.full_name}</p>
              </div>
            </div>

            <p className="text-white/70 text-sm font-medium mb-1">{greeting()},</p>
            <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
              {profile?.full_name?.split(' ')[0] ?? 'Profe'} 👋
            </h1>

            <div className="flex items-center gap-3 flex-wrap">
              {selectedCategory && (
                <div className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold',
                  catStyle?.bg, catStyle?.text,
                )}>
                  <span className={clsx('w-1.5 h-1.5 rounded-full', TEAM_CATEGORY_BG[selectedCategory])}/>
                  {selectedCategory}
                </div>
              )}
              {!loading && monthCount > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white/15 text-white">
                  <TrendingUp size={11}/>
                  {monthCount} {monthCount === 1 ? 'sesión' : 'sesiones'} este mes
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-10 space-y-5 pb-10">
          {/* Acciones principales */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/crear')}
              className="group flex flex-col gap-3 bg-amber-400 hover:bg-amber-500 rounded-2xl p-4 text-left shadow-md transition-all active:scale-[0.97]"
            >
              <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center">
                <PlusCircle size={22} className="text-gray-900"/>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm leading-tight">Crear entrenamiento</p>
                <p className="text-gray-700/70 text-xs mt-0.5">Nuevo plan</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/biblioteca')}
              className="group flex flex-col gap-3 rounded-2xl p-4 text-left shadow-md transition-all active:scale-[0.97] hover:brightness-110"
              style={{ backgroundColor: color }}
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <BookOpen size={22} className="text-white"/>
              </div>
              <div>
                <p className="font-bold text-white text-sm leading-tight">Biblioteca</p>
                <p className="text-white/60 text-xs mt-0.5">Entrenamientos</p>
              </div>
            </button>
          </div>

          {/* Accesos rápidos */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-0.5">
              Accesos rápidos
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc }) => (
                <button key={to} onClick={() => navigate(to)}
                  className="flex items-center gap-3 bg-white rounded-xl p-3 text-left border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all active:scale-[0.98]">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-gray-600"/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{label}</p>
                    <p className="text-[10px] text-gray-400 truncate">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Últimos entrenamientos */}
          {!loading && recent.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  Últimas sesiones
                </p>
                {daysSinceLast !== null && (
                  <p className="text-[11px] text-gray-400">
                    hace {daysSinceLast === 0 ? 'hoy' : `${daysSinceLast}d`}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                {recent.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/entrenamiento/${s.id}`)}
                    className="w-full flex items-center gap-3 bg-white rounded-xl px-3.5 py-3 text-left border border-gray-100 hover:shadow-sm transition-all active:scale-[0.99]"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                      style={{ backgroundColor: i === 0 ? color : `${color}60` }}>
                      {s.session_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {s.team_category} · {s.content_category}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {format(new Date(s.session_date), "d MMM", { locale: es })} · {s.total_duration_min} min
                      </p>
                    </div>
                    <ChevronRight size={13} className="text-gray-300 flex-shrink-0"/>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal novedades */}
      {showNews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ backgroundColor: color }}>
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-white/80"/>
                <div>
                  <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Novedades</p>
                  <p className="text-white font-bold text-base leading-tight">HandPlan se actualizó 🎉</p>
                </div>
              </div>
              <button type="button" onClick={closeNews} className="text-white/50 hover:text-white transition-colors mt-0.5">
                <X size={16}/>
              </button>
            </div>
            <div className="px-6 py-4 space-y-3.5">
              {[
                { emoji: '🎬', title: 'Pizarra animada', desc: 'Creá jugadas por fotogramas y exportalas como MP4 para mandar por WhatsApp.' },
                { emoji: '📁', title: 'Carpetas de ejercicios', desc: 'Organizá tu biblioteca en carpetas como quieras.' },
                { emoji: '💪', title: 'Preparadores físicos', desc: 'Asistencia, PSE y carga de entrenamiento con seguimiento estadístico.' },
              ].map(({ emoji, title, desc }) => (
                <div key={title} className="flex gap-3">
                  <span className="text-xl flex-shrink-0">{emoji}</span>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 pb-5">
              <button type="button" onClick={closeNews}
                className="w-full py-2.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: color }}>
                ¡Entendido, vamos!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
