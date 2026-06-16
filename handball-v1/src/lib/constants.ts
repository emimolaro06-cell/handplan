import type { TeamCategory, ContentCategory, ExerciseCategory } from '@/types'

export const TEAM_CATEGORIES: TeamCategory[] = [
  'Infantiles', 'Menores', 'Cadetes', 'Juveniles', 'Primera',
]

export const CONTENT_CATEGORIES: ContentCategory[] = [
  'Técnica individual OFENSIVA',
  'Técnica individual DEFENSIVA',
  'Táctica OFENSIVA',
  'Táctica DEFENSIVA',
  'MIXTO',
]

export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  'Calentamiento',
  'Técnica individual',
  'Táctica colectiva',
  'Físico',
  'Vuelta a la calma',
  'Juego reducido',
  'Portero',
  'Otro',
]

// Colores por categoría de equipo (badge)
export const TEAM_CATEGORY_STYLES: Record<TeamCategory, { bg: string; text: string; dot: string }> = {
  Infantiles: { bg: 'bg-sky-100',    text: 'text-sky-800',    dot: 'bg-sky-500' },
  Menores:    { bg: 'bg-dj-100',     text: 'text-dj-800',     dot: 'bg-dj-500' },
  Cadetes:    { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500' },
  Juveniles:  { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  Primera:    { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500' },
}

export const TEAM_CATEGORY_BG: Record<TeamCategory, string> = {
  Infantiles: 'bg-sky-500',
  Menores:    'bg-dj-600',
  Cadetes:    'bg-amber-500',
  Juveniles:  'bg-purple-600',
  Primera:    'bg-red-600',
}

// Colores para avatares de usuarios
export const AVATAR_COLORS = [
  '#1e8a1e', '#1d4ed8', '#7c3aed', '#b45309',
  '#be185d', '#0f766e', '#c2410c', '#1e40af',
]

export const CLUB_NAME = 'HANDBALL DEFENSA Y JUSTICIA'
