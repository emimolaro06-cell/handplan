import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PlusCircle, BookOpen, Dumbbell,
  LogOut, Menu, X, ChevronRight, CalendarDays, UserCheck, Users, Layers, Activity,
} from 'lucide-react'
import { clsx } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { signOut } from '@/lib/supabase'
import { TEAM_CATEGORY_BG } from '@/lib/constants'
import type { TeamCategory } from '@/types'

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { to: '/menu',    icon: LayoutDashboard, label: 'Inicio' },
      { to: '/crear',   icon: PlusCircle,      label: 'Crear entrenamiento' },
    ],
  },
  {
    label: 'Contenido',
    items: [
      { to: '/biblioteca',  icon: BookOpen,   label: 'Biblioteca' },
      { to: '/ejercicios',  icon: Dumbbell,   label: 'Ejercicios' },
      { to: '/pizarra',     icon: Layers,     label: 'Pizarra' },
    ],
  },
  {
    label: 'Planificación',
    items: [
      { to: '/planificacion', icon: CalendarDays, label: 'Planificación mensual' },
    ],
  },
  {
    label: 'Equipo',
    items: [
      { to: '/asistencia',         icon: UserCheck, label: 'Asistencia' },
      { to: '/preparacion-fisica', icon: Activity,  label: 'Preparación Física' },
    ],
  },
]

function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount)))
  return `rgb(${r}, ${g}, ${b})`
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    profile, account, selectedCategory, setSelectedCategory, sidebarOpen, setSidebarOpen,
    effectiveCategories, assistantOfCoachName,
  } = useAppStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  const initials = profile?.full_name
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '••'

  const color = account?.primary_color || '#1e8a1e'
  const colorDark = shade(color, 0.6)
  const colorDarker = shade(color, 0.7)
  const accountName = account?.name || 'HandPlan'
  const logoUrl = account?.logo_url || '/logo-handplan.svg'

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)}/>
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-60 z-30 flex flex-col',
          'transition-transform duration-200 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:static lg:z-auto',
        )}
        style={{ backgroundColor: colorDark }}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-white/10 flex items-center justify-center">
              <img src={logoUrl} alt={accountName} className="w-full h-full object-contain"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight truncate">{accountName}</p>
              <p className="text-[10px] text-white/40 leading-tight font-medium tracking-wide">HandPlan</p>
            </div>
            <button className="lg:hidden text-white/40 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* Banner AT */}
        {assistantOfCoachName && (
          <div className="px-3 py-2 bg-amber-400/15 border-b border-amber-400/20">
            <p className="text-[11px] text-amber-200/90 leading-snug">
              Viendo datos de <span className="font-bold">{assistantOfCoachName}</span>
            </p>
          </div>
        )}

        {/* Categorías */}
        {profile && effectiveCategories.length > 0 && (
          <div className="px-3 py-3 border-b border-white/10">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 px-1 font-semibold">
              {assistantOfCoachName ? 'Categoría' : 'Mi categoría'}
            </p>
            <div className="space-y-0.5">
              {effectiveCategories.map((cat: TeamCategory) => (
                <button key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all',
                    cat === selectedCategory
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/50 hover:text-white hover:bg-white/8',
                  )}>
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', TEAM_CATEGORY_BG[cat])}/>
                  {cat}
                  {cat === selectedCategory && <ChevronRight size={10} className="ml-auto opacity-60"/>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nav agrupado */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1 px-2 font-semibold">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) => clsx(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all relative',
                      isActive
                        ? 'bg-white/12 text-white font-semibold'
                        : 'text-white/50 hover:text-white/90 hover:bg-white/8',
                    )}>
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-white/80"/>
                        )}
                        <Icon size={15} className="flex-shrink-0"/>
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          {!assistantOfCoachName && (
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1 px-2 font-semibold">
                Cuerpo técnico
              </p>
              <NavLink to="/mi-ayudante"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all relative',
                  isActive
                    ? 'bg-white/12 text-white font-semibold'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/8',
                )}>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-white/80"/>
                    )}
                    <Users size={15} className="flex-shrink-0"/>
                    Mi ayudante técnico
                  </>
                )}
              </NavLink>
            </div>
          )}
        </nav>

        {/* Perfil */}
        {profile && (
          <div className="px-3 py-3 border-t border-white/10">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                style={{ backgroundColor: profile.avatar_color ?? color }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate leading-tight">{profile.full_name}</p>
                <p className="text-[10px] text-white/35">@{profile.username}</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/70 transition-colors">
              <LogOut size={11}/> Cerrar sesión
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="lg:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
          style={{ backgroundColor: colorDarker }}
        >
          <button onClick={() => setSidebarOpen(true)} className="text-white/70 hover:text-white">
            <Menu size={20}/>
          </button>
          <span className="text-white font-semibold text-sm flex-1 truncate">{accountName}</span>
          {selectedCategory && (
            <span className={clsx('text-[11px] font-bold text-white px-2 py-0.5 rounded-md', TEAM_CATEGORY_BG[selectedCategory])}>
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
