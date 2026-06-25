import { clsx } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, BookOpen, ChevronRight, Calendar, Clock } from 'lucide-react'
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

  const catStyle = selectedCategory ? TEAM_CATEGORY_STYLES[selectedCategory] : null
  const color = account?.primary_color || '#1e8a1e'
  const logoUrl = account?.logo_url || '/logo-handplan.svg'
  const accountName = account?.name || 'HandPlan'

  return (
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
  )
}
