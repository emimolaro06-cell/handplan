import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { CheckCircle, ChevronRight } from 'lucide-react'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/index'
import { TEAM_CATEGORY_BG } from '@/lib/constants'
import type { TeamCategory } from '@/types'

export function CategoryPage() {
  const navigate = useNavigate()
  const { profile, account, trainerLinkOptions, setSelectedCategory, setEffectiveUserId } = useAppStore()
  const [selected, setSelected] = useState<TeamCategory | null>(null)

  if (!profile) { navigate('/'); return null }
  if (profile.role === 'admin') { navigate('/admin'); return null }

  const isTrainer = profile.role === 'preparador_fisico'
  const options = isTrainer ? trainerLinkOptions : profile.categories.map(cat => ({ category: cat, coachId: null, coachName: '' }))

  function handleSelect(cat: TeamCategory, coachId: string | null) {
    setSelected(cat)
    // Para el Preparador Físico, elegir una categoría también fija con qué coach está
    // trabajando ahora mismo — effectiveUserId pasa a ser el id de ESE coach específico.
    // Se persiste en localStorage para que un refresh de página no lo pierda.
    if (isTrainer && coachId) {
      setEffectiveUserId(coachId)
      localStorage.setItem('handplan_trainer_active_coach', coachId)
      localStorage.setItem('handplan_trainer_active_category', cat)
    }
  }

  function handleContinue() {
    if (!selected) return
    setSelectedCategory(selected)
    navigate('/menu')
  }

  const color = account?.primary_color || '#1e8a1e'
  const logoUrl = account?.logo_url || '/logo-handplan.svg'
  const accountName = account?.name || 'HandPlan'

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${color}33 0%, ${color} 50%, ${color}cc 100%)` }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/15 border-2 border-white/25 mb-3 overflow-hidden">
            <img src={logoUrl} alt={accountName} className="w-14 h-14 object-contain"/>
          </div>
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">
            {accountName}
          </p>
          <h1 className="text-2xl font-bold text-white font-display">
            {isTrainer ? 'Seleccioná con quién trabajás' : 'Seleccioná tu categoría'}
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Hola, <span className="text-white font-medium">{profile.full_name}</span>
          </p>
        </div>

        {/* Sin vínculos todavía (Preparador Físico recién registrado, sin categorías con coach asignado) */}
        {isTrainer && options.length === 0 && (
          <div className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-6 text-center">
            <p className="text-white/80 text-sm">
              Todavía no tenés categorías vinculadas. Pedile a tu club que te confirme qué categorías tenés asignadas.
            </p>
          </div>
        )}

        {/* Lista de categorías (o de vínculos categoría+coach, si es Preparador Físico) */}
        <div className="space-y-2 mb-6">
          {options.map(opt => {
            const cat = opt.category
            const isSelected = selected === cat
            return (
              <button
                key={`${cat}-${opt.coachId ?? ''}`}
                onClick={() => handleSelect(cat, opt.coachId)}
                className={clsx(
                  'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-150 text-left',
                  isSelected
                    ? 'bg-white border-white shadow-lg scale-[1.01]'
                    : 'bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/40',
                )}
              >
                <div className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold',
                  TEAM_CATEGORY_BG[cat],
                )}>
                  {cat.slice(0, 3).toUpperCase()}
                </div>

                <div className="flex-1">
                  <p className={clsx(
                    'font-semibold text-base',
                    isSelected ? 'text-gray-900' : 'text-white',
                  )}>
                    {cat}
                  </p>
                  {isTrainer && opt.coachName && (
                    <p className={clsx('text-xs', isSelected ? 'text-gray-500' : 'text-white/60')}>
                      Entrenador: {opt.coachName}
                    </p>
                  )}
                </div>

                {isSelected
                  ? <CheckCircle size={22} style={{ color }} className="flex-shrink-0"/>
                  : <ChevronRight size={18} className="text-white/30 flex-shrink-0"/>
                }
              </button>
            )
          })}
        </div>

        <Button
          className="w-full"
          size="lg"
          variant="gold"
          disabled={!selected}
          onClick={handleContinue}
          icon={<ChevronRight size={18}/>}
        >
          Continuar
        </Button>
      </div>
    </div>
  )
}
