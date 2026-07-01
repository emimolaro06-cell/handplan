import { clsx } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, BookOpen, ChevronRight, Calendar, Clock, X, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAppStore } from '@/lib/store'
import { getSessions } from '@/lib/supabase'
import { TEAM_CATEGORY_BG, TEAM_CATEGORY_STYLES } from '@/lib/constants'
import type { TrainingSession } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function MenuPage() {
  const navigate = useNavigate()
  const { profile, account, effectiveUserId, selectedCategory } = useAppStore()
  const [recent, setRecent] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!effectiveUserId) return
    getSessions(effectiveUserId, { team_category: selectedCategory ?? undefined })
      .then(({ data }) => {
        setRecent(((data as TrainingSession[]) ?? []).slice(0, 3))
        setLoading(false)
      })
  }, [effectiveUserId, selectedCategory])

  const CURRENT_VERSION = 'v1.2'
  const [showNews, setShowNews] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('handplan_news_seen')
    if (seen !== CURRENT_VERSION) setShowNews(true)
  }, [])

  function closeNews() {
    localStorage.setItem('handplan_news_seen', CURRENT_VERSION)
    setShowNews(false)
  }
  const color = account?.primary_color || '#1e8a1e'
  const logoUrl = account?.logo_url || '/logo-handplan.svg'
  const accountName = account?.name || 'HandPlan'
  const catStyle = selectedCategory ? TEAM_CATEGORY_STYLES[selectedCategory] : null

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="px-6 pt-10 pb-16" style={{ backgroundColor: color }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <img src={logoUrl} alt={accountName} className="w-10 h-10 object-contain"/>
            <div>
              <p className="text-white/80 text-xs font-bold uppercase tracking-widest">
                {accountName}
              </p>
              <p className="text-white/60 text-xs">
                {profile?.full_name}
              </p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white font-display mb-1">
            Buen día 👋
          </h1>

          {selectedCategory && (
            <div className={clsx(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold mt-2',
              catStyle?.bg, catStyle?.text,
            )}>
              <span className={clsx('w-2 h-2 rounded-full', TEAM_CATEGORY_BG[selectedCategory])}/>
              {selectedCategory}
            </div>
          )}
        </div>
      </div>

      {/* Cards flotantes */}
      <div className="max-w-lg mx-auto px-4 -mt-8 space-y-4">
        {/* Crear entrenamiento */}
        <button
          onClick={() => navigate('/crear')}
          className="group w-full flex items-center gap-5 bg-gold-400 hover:bg-gold-500 rounded-2xl p-5 text-left shadow-lg transition-all active:scale-[0.98]"
        >
          <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center flex-shrink-0">
            <PlusCircle size={28} className="text-gray-900"/>
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-lg">Crear entrenamiento</p>
            <p className="text-gray-700 text-sm mt-0.5">Nuevo plan desde cero</p>
          </div>
          <ChevronRight size={22} className="text-gray-700 group-hover:translate-x-1 transition-transform"/>
        </button>

        {/* Biblioteca */}
        <button
          onClick={() => navigate('/biblioteca')}
          className="group w-full flex items-center gap-5 hover:opacity-90 rounded-2xl p-5 text-left shadow-lg transition-all active:scale-[0.98]"
          style={{ backgroundColor: color }}
        >
          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <BookOpen size={28} className="text-white"/>
          </div>
          <div className="flex-1">
            <p className="font-bold text-white text-lg">Biblioteca</p>
            <p className="text-white/70 text-sm mt-0.5">Buscar entrenamientos anteriores</p>
          </div>
          <ChevronRight size={22} className="text-white/60 group-hover:translate-x-1 transition-transform"/>
        </button>

        {/* Entrenamientos recientes */}
        {!loading && recent.length > 0 && (
          <div className="pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
              Últimos entrenamientos
            </p>
            <div className="space-y-2">
              {recent.map(s => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/entrenamiento/${s.id}`)}
                  className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 text-left border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="w-9 h-9 rounded-lg bg-dj-50 flex items-center justify-center flex-shrink-0">
                    <Calendar size={16} className="text-dj-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Sesión {s.session_number} — {s.team_category}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(s.session_date), "d MMM yyyy", { locale: es })} · {s.total_duration_min} min
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 flex-shrink-0"/>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Modal de novedades */}
    {showNews && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ backgroundColor: color }}>
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-white/80" />
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Novedades</p>
                <p className="text-white font-bold text-lg leading-tight">¡HandPlan se actualizó! 🎉</p>
              </div>
            </div>
            <button type="button" onClick={closeNews} className="text-white/60 hover:text-white transition-colors mt-0.5">
              <X size={18} />
            </button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="flex gap-3">
              <span className="text-2xl flex-shrink-0">🎬</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Pizarra animada</p>
                <p className="text-gray-500 text-xs mt-0.5">Creá jugadas por fotogramas y exportalas directo como MP4 para mandarle a los jugadores por WhatsApp.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl flex-shrink-0">📁</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Carpetas de ejercicios</p>
                <p className="text-gray-500 text-xs mt-0.5">Organizá tu biblioteca de ejercicios en carpetas como quieras. Mucho más fácil encontrar lo que necesitás.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl flex-shrink-0">💪</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Preparadores físicos</p>
                <p className="text-gray-500 text-xs mt-0.5">El preparador ya puede tomar asistencia de su hora, cargar el PSE de cada jugador y ver el seguimiento estadístico del mes.</p>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6">
            <button type="button" onClick={closeNews}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
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
