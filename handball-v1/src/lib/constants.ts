import type { TeamCategory, ContentCategory, ExerciseCategory } from '@/types'

export const CLUB_CODE = 'DYJHANDBALL2025'

export const TEAM_CATEGORIES: TeamCategory[] = [
  'Minis A', 'Minis B',
  'Infantiles A', 'Infantiles B',
  'Menores A', 'Menores B',
  'Cadetes A', 'Cadetes B',
  'Juveniles A', 'Juveniles B',
  'Juniors A', 'Juniors B',
  'Primera A', 'Primera B',
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

export const TEAM_CATEGORY_STYLES: Record<TeamCategory, { bg: string; text: string; dot: string }> = {
  'Minis A':      { bg: 'bg-pink-100',   text: 'text-pink-800',   dot: 'bg-pink-500' },
  'Minis B':      { bg: 'bg-pink-100',   text: 'text-pink-800',   dot: 'bg-pink-400' },
  'Infantiles A': { bg: 'bg-sky-100',    text: 'text-sky-800',    dot: 'bg-sky-500' },
  'Infantiles B': { bg: 'bg-sky-100',    text: 'text-sky-800',    dot: 'bg-sky-400' },
  'Menores A':    { bg: 'bg-dj-100',     text: 'text-dj-800',     dot: 'bg-dj-600' },
  'Menores B':    { bg: 'bg-dj-100',     text: 'text-dj-800',     dot: 'bg-dj-500' },
  'Cadetes A':    { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500' },
  'Cadetes B':    { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-400' },
  'Juveniles A':  { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-600' },
  'Juveniles B':  { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-400' },
  'Juniors A':    { bg: 'bg-teal-100',   text: 'text-teal-800',   dot: 'bg-teal-600' },
  'Juniors B':    { bg: 'bg-teal-100',   text: 'text-teal-800',   dot: 'bg-teal-400' },
  'Primera A':    { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-600' },
  'Primera B':    { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-400' },
}

export const TEAM_CATEGORY_BG: Record<TeamCategory, string> = {
  'Minis A':      'bg-pink-500',
  'Minis B':      'bg-pink-400',
  'Infantiles A': 'bg-sky-500',
  'Infantiles B': 'bg-sky-400',
  'Menores A':    'bg-dj-600',
  'Menores B':    'bg-dj-500',
  'Cadetes A':    'bg-amber-500',
  'Cadetes B':    'bg-amber-400',
  'Juveniles A':  'bg-purple-600',
  'Juveniles B':  'bg-purple-400',
  'Juniors A':    'bg-teal-600',
  'Juniors B':    'bg-teal-400',
  'Primera A':    'bg-red-600',
  'Primera B':    'bg-red-400',
}

export const AVATAR_COLORS = [
  '#1e8a1e', '#1d4ed8', '#7c3aed', '#b45309',
  '#be185d', '#0f766e', '#c2410c', '#1e40af',
]

export const CLUB_NAME = 'HANDBALL DEFENSA Y JUSTICIA'
