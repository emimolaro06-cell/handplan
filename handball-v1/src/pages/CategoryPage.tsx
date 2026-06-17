import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { CheckCircle, ChevronRight } from 'lucide-react'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/index'
import { TEAM_CATEGORY_BG, CLUB_NAME } from '@/lib/constants'
import type { TeamCategory } from '@/types'

export function CategoryPage() {
  const navigate = useNavigate()
  const { profile, setSelectedCategory } = useAppStore()
  const [selected, setSelected] = useState<TeamCategory | null>(null)

  if (!profile) { navigate('/'); return null }
  if (profile.role === 'admin') { navigate('/admin'); return null }

  function handleContinue() {
    if (!selected) return
    setSelectedCategory(selected)
    navigate('/menu')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #072d07 0%, #1e8a1e 50%, #0d420d 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-400/20 border-2 border-gold-400/40 mb-3 overflow-hidden">
            <img src="/logo-dj.png" alt="Logo" className="w-14 h-14 object-contain"/>
          </div>
          <p className="text-gold-400 text-xs font-bold uppercase tracking-widest mb-1">
            {CLUB_NAME}
          </p>
          <h1 className="text-2xl font-bold text-white font-display">
            Seleccioná tu categoría
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Hola, <span className="text-white font-medium">{profile.full_name}</span>
          </p>
        </div>

        {/* Lista de categorías — solo nombre, sin descripción */}
        <div className="space-y-2 mb-6">
          {profile.categories.map((cat: TeamCategory) => {
            const isSelected = selected === cat
            return (
              <button
                key={cat}
                onClick={() => setSelected(cat)}
                className={clsx(
                  'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-150 text-left',
                  isSelected
                    ? 'bg-white border-gold-400 shadow-lg scale-[1.01]'
                    : 'bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/40',
                )}
              >
                <div className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold',
                  TEAM_CATEGORY_BG[cat],
                )}>
                  {cat.slice(0, 3).toUpperCase()}
                </div>

                <p className={clsx(
                  'font-semibold text-base flex-1',
                  isSelected ? 'text-gray-900' : 'text-white',
                )}>
                  {cat}
                </p>

                {isSelected
                  ? <CheckCircle size={22} className="text-dj-600 flex-shrink-0"/>
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
