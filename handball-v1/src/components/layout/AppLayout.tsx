import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PlusCircle, BookOpen, Dumbbell,
  LogOut, Menu, X, ChevronRight, CalendarDays, UserCheck,
} from 'lucide-react'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { signOut } from '@/lib/supabase'
import { TEAM_CATEGORY_BG, CLUB_NAME } from '@/lib/constants'
import type { TeamCategory } from '@/types'

const NAV = [
  { to: '/menu',          icon: LayoutDashboard, label: 'Inicio' },
  { to: '/crear',         icon: PlusCircle,      label: 'Crear entrenamiento' },
  { to: '/biblioteca',    icon: BookOpen,         label: 'Biblioteca' },
  { to: '/ejercicios',    icon: Dumbbell,         label: 'Ejercicios' },
  { to: '/planificacion', icon: CalendarDays,     label: 'Planificación mensual' },
  { to: '/asistencia',    icon: UserCheck,        label: 'Asistencia' },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, selectedCategory, setSelectedCategory, sidebarOpen, setSidebarOpen } = useAppStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  const initials = profile?.full_name
    .split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() ?? 'DJ'

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)}/>
      )}

      <aside className={clsx(
        'fixed top-0 left-0 h-full w-64 z-30 flex flex-col',
        'bg-dj-900 text-white transition-transform duration-200 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0 lg:static lg:z-auto',
      )}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <img src="/logo-dj.png" alt="Logo" className="w-full h-full object-contain"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gold-400 leading-tight uppercase tracking-wide">Handball</p>
              <p className="text-xs text-white/60 leading-tight truncate">Defensa y Justicia</p>
            </div>
            <button className="lg:hidden text-white/50 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* Categorías */}
        {profile && (
          <div className="px-4 py-4 border-b border-white/10">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2 px-1">Mi categoría</p>
            <div className="space-y-1">
              {profile.categories.map((cat: TeamCategory) => (
                <button key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all',
                    cat === selectedCategory
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/60 hover:text-white hover:bg-white/10',
                  )}>
                  <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', TEAM_CATEGORY_BG[cat])}/>
                  {cat}
                  {cat === selectedCategory && <ChevronRight size={12} className="ml-auto opacity-70"/>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                isActive
                  ? 'bg-gold-400/20 text-gold-300 font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/10',
              )}>
              <Icon size={17}/>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Perfil */}
        {profile && (
          <div className="px-4 py-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: profile.avatar_color ?? '#1e8a1e' }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
                <p className="text-xs text-white/40">@{profile.username}</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors">
              <LogOut size={13}/> Cerrar sesión
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-dj-900 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-white/70 hover:text-white">
            <Menu size={22}/>
          </button>
          <span className="text-white font-semibold text-sm flex-1">Handball D&J</span>
          {selectedCategory && (
            <span className={clsx('text-xs font-bold text-white px-2.5 py-1 rounded-lg', TEAM_CATEGORY_BG[selectedCategory])}>
              {selectedCategory}
            </span>
          )}
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
