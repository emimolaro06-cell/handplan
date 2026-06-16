// ─── Categorías de equipo ────────────────────────────────────────────────────
export type TeamCategory =
  | 'Minis A' | 'Minis B'
  | 'Infantiles A' | 'Infantiles B'
  | 'Menores A' | 'Menores B'
  | 'Cadetes A' | 'Cadetes B'
  | 'Juveniles A' | 'Juveniles B'
  | 'Primera A' | 'Primera B'

// ─── Categorías de contenido ─────────────────────────────────────────────────
export type ContentCategory =
  | 'Técnica individual OFENSIVA'
  | 'Técnica individual DEFENSIVA'
  | 'Táctica OFENSIVA'
  | 'Táctica DEFENSIVA'
  | 'MIXTO'

// ─── Categorías de ejercicio ─────────────────────────────────────────────────
export type ExerciseCategory =
  | 'Calentamiento'
  | 'Técnica individual'
  | 'Táctica colectiva'
  | 'Físico'
  | 'Vuelta a la calma'
  | 'Juego reducido'
  | 'Portero'
  | 'Otro'

// ─── Usuario / Perfil ────────────────────────────────────────────────────────
export interface Profile {
  id: string
  username: string
  full_name: string
  role: 'admin' | 'coach'
  categories: TeamCategory[]
  club_name: string
  avatar_color: string
  created_at: string
}

// ─── Etiqueta de ejercicio personalizable ────────────────────────────────────
export interface ExerciseLabel {
  id: string
  label: string
  created_by: string
  created_at: string
}

// ─── Momento de entrenamiento ────────────────────────────────────────────────
export interface Moment {
  id: string
  session_id: string
  order_index: number
  exercise_label: string
  duration_min: number
  exercise_category: ExerciseCategory
  image_url: string | null
  description: string
  observations: string
}

export type MomentDraft = Omit<Moment, 'id' | 'session_id' | 'order_index'>

// ─── Sesión de entrenamiento ─────────────────────────────────────────────────
export type SessionStatus = 'draft' | 'saved'

export interface TrainingSession {
  id: string
  user_id: string
  coach_name: string
  team_category: TeamCategory
  content_category: ContentCategory
  session_date: string
  session_number: number
  total_duration_min: number
  general_objective: string
  main_content: string
  status: SessionStatus
  created_at: string
  updated_at: string
  moments: Moment[]
}

export type SessionFormData = Omit<
  TrainingSession,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'moments'
>

// ─── Biblioteca de ejercicios ────────────────────────────────────────────────
export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  image_url: string | null
  description: string
  objectives: string
  recommended_age: string
  created_by: string
  created_at: string
}

// ─── Filtros de biblioteca ───────────────────────────────────────────────────
export interface LibraryFilters {
  search: string
  team_category: TeamCategory | ''
  content_category: ContentCategory | ''
  coach_name: string
}
