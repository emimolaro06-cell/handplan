import { clsx } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import {
  PlusCircle, BookOpen, CalendarDays,
  UserCheck, Layers, Activity, X, Sparkles, AlertTriangle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { getSessions } from '@/lib/supabase'
import { TEAM_CATEGORY_BG, TEAM_CATEGORY_STYLES } from '@/lib/constants'
import type { TrainingSession } from '@/types'
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
  { to: '/pizarra',            icon: Layers,      label: 'Pizarra',       desc: 'Jugadas animadas'   },
  { to: '/planificacion',      icon: CalendarDays, label: 'Planificación', desc: 'Calendario mensual' },
  { to: '/asistencia',         icon: UserCheck,   label: 'Asistencia',    desc: 'Marcar presentes'   },
  { to: '/preparacion-fisica', icon: Activity,    label: 'Físico',        desc: 'PSE y carga'        },
]

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export function MenuPage() {
  const navigate = useNavigate()
  const { profile, account, effectiveUserId, selectedCategory } = useAppStore()
  const now = useClock()

  const [monthCount, setMonthCount]       = useState(0)
  const [yearCount, setYearCount]         = useState(0)
  const [monthlyData, setMonthlyData]     = useState<number[]>(Array(12).fill(0))
  const [attendancePct, setAttendancePct] = useState<number | null>(null)
  const [daysSinceLast, setDaysSinceLast] = useState<number | null>(null)
  const [noSessionsWeek, setNoSessionsWeek] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!effectiveUserId) return
    setLoading(true)
    const today = new Date()
    getSessions(effectiveUserId, { team_category: selectedCategory ?? undefined })
      .then(({ data }) => {
        const sessions = (data as TrainingSession[]) ?? []

        // Últimos 7 días sin sesiones
        const lastSession = sessions[0]
        if (lastSession) {
          const diff = differenceInDays(today, new Date(lastSession.session_date))
          setDaysSinceLast(diff)
          setNoSessionsWeek(diff >= 7)
        } else {
          setNoSessionsWeek(true)
        }

        // Mes actual
        const monthSessions = sessions.filter(s => {
          const d = new Date(s.session_date)
          return d >= startOfMonth(today) && d <= endOfMonth(today)
        })
        setMonthCount(monthSessions.length)

        // Año actual
        const yearStart = startOfYear(today)
        const yearSessions = sessions.filter(s => new Date(s.session_date) >= yearStart)
        setYearCount(yearSessions.length)

        // Por mes (gráfico)
        const byMonth = Array(12).fill(0)
        yearSessions.forEach(s => {
          const m = getMonth(new Date(s.session_date))
          byMonth[m]++
        })
        setMonthlyData(byMonth)
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

  const color    = account?.primary_color || '#1e8a1e'
  const logoUrl  = account?.logo_url || '/logo-handplan.svg'
  const accountName = account?.name || 'HandPlan'
  const catStyle = selectedCategory ? TEAM_CATEGORY_STYLES[selectedCategory] : null

  const maxBar = Math.max(...monthlyData, 1)
  const currentMonth = getMonth(now)

  const clockStr = format(now, 'HH:mm')
  const dateStr  = format(now, "EEE d MMM yyyy", { locale: es })

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <div className="px-5 pt-8 pb-20 relative overflow-hidden"
          style={{ backgroundColor: color }}>
          <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full opacity-[0.07]"
            style={{ backgroundColor: 'white' }}/>
          <div className="absolute right-8 bottom-0 w-28 h-28 rounded-full opacity-[0.04]"
            style={{ backgroundColor: 'white' }}/>

          <div className="max-w-lg mx-auto relative">
            {/* Logo + reloj */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5">
                <img src={logoUrl} alt={accountName} className="w-8 h-8 object-contain"/>
                <div>
                  <p className="text-white/90 text-[11px] font-bold uppercase tracking-widest leading-tight">{accountName}</p>
                  <p className="text-white/40 text-[10px] leading-tight">{profile?.full_name}</p>
                </div>
              </div>
              {/* Reloj arriba a la derecha */}
              <div className="text-right bg-black/20 rounded-xl px-3 py-2">
                <p className="text-white text-base font-medium leading-none tracking-wide">{clockStr}</p>
                <p className="text-white/45 text-[10px] mt-1 leading-none capitalize">{dateStr}</p>
              </div>
            </div>

            <p className="text-white/60 text-xs font-medium mb-0.5">{greeting()},</p>
            <h1 className="text-[28px] font-bold text-white mb-3 leading-tight">
              {profile?.full_name?.split(' ')[0] ?? 'Profe'}
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
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-10 space-y-4 pb-10">
          {/* ── ALERTA ────────────────────────────────────────────────── */}
          {!loading && noSessionsWeek && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5"/>
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

          {/* ── STATS ─────────────────────────────────────────────────── */}
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

          {/* ── GRÁFICO SESIONES POR MES ──────────────────────────────── */}
          {yearCount > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 px-4 pt-3 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-700">Sesiones por mes</p>
                <p className="text-[10px] text-gray-400">Temporada {now.getFullYear()}</p>
              </div>
              <div className="flex items-end gap-1.5" style={{ height: 60 }}>
                {monthlyData.map((count, i) => {
                  const h = count === 0 ? 2 : Math.round((count / maxBar) * 60)
                  const isCurrent = i === currentMonth
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm"
                        style={{
                          height: h,
                          backgroundColor: isCurrent ? color : `${color}55`,
                          minHeight: 2,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {MONTH_LABELS.map((l, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className={clsx(
                      'text-[8px]',
                      i === currentMonth ? 'font-bold text-gray-600' : 'text-gray-300',
                    )}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ACCIONES PRINCIPALES ──────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('/crear')}
              className="flex flex-col gap-3 bg-amber-400 hover:bg-amber-500 rounded-2xl p-4 text-left transition-all active:scale-[0.97]"
            >
              <div className="w-9 h-9 rounded-xl bg-black/10 flex items-center justify-center">
                <PlusCircle size={20} className="text-gray-900"/>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm leading-tight">Crear entrenamiento</p>
                <p className="text-gray-800/50 text-xs mt-0.5">Nuevo plan</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/biblioteca')}
              className="flex flex-col gap-3 rounded-2xl p-4 text-left transition-all active:scale-[0.97]"
              style={{ backgroundColor: color }}
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <BookOpen size={20} className="text-white"/>
              </div>
              <div>
                <p className="font-bold text-white text-sm leading-tight">Biblioteca</p>
                <p className="text-white/50 text-xs mt-0.5">Entrenamientos</p>
              </div>
            </button>
          </div>

          {/* ── ACCESOS RÁPIDOS ───────────────────────────────────────── */}
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
      </div>

      {/* ── MODAL NOVEDADES ───────────────────────────────────────────── */}
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
