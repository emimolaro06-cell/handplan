// ─── Categorías de equipo ────────────────────────────────────────────────────
export type TeamCategory =
  | 'Minis A' | 'Minis B'
  | 'Infantiles A' | 'Infantiles B'
  | 'Menores A' | 'Menores B'
  | 'Cadetes A' | 'Cadetes B'
  | 'Juveniles A' | 'Juveniles B'
  | 'Juniors A' | 'Juniors B'
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
  account_id: string | null
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
  content_category: ContentCategory | null   // una de las 5 generales, para estadísticas del Macrociclo
  subcontent_id: string | null               // subcontenido personalizado del profe, dentro de content_category
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

// ─── Macrociclo / Microciclos (v3 — labels array + imagen por día) ───────────
// Mesociclo = un mes calendario (automático, no es tabla)
// Microciclo = una semana Lunes-Domingo dentro de un mes (automático, no es tabla)

export interface MicrocycleMoment {
  id: string
  order: number
  content: string
  category: ContentCategory | null
  subcontent_id: string | null   // subcontenido personalizado del profe, dentro de category
}

export interface MicrocycleDay {
  id: string
  macrocycle_id: string
  date: string               // 'yyyy-MM-dd'
  labels: string[]           // chips libres: ["Sesión físico", "vs Racing", ...]
  rival_logo_url: string | null
  moments: MicrocycleMoment[]
  created_at: string
  updated_at: string
}

export interface Macrocycle {
  id: string
  user_id: string
  team_category: TeamCategory
  name: string
  start_date: string
  end_date: string | null
  objective: string | null
  annual_objective: string | null
  annual_observations: string | null
  created_at: string
  updated_at: string
}

export interface SharedMicrocycle {
  id: string
  macrocycle_id: string
  week_start_date: string    // Lunes de la semana compartida, 'yyyy-MM-dd'
  token: string
  created_by: string
  created_at: string
}

// Conteo de categorías para el gráfico de radar del Macrociclo
export type ContentCategoryStats = Record<ContentCategory, number>

// ─── Comentarios del coordinador (admin) sobre un entrenamiento ──────────────
export interface TrainingComment {
  id: string
  session_id: string
  admin_id: string
  comment: string
  created_at: string
  admin_name?: string  // se completa al hacer join con profiles, si corresponde
}

// ─── Subcontenidos personalizados (por profe, dentro de cada categoría general) ──
export interface Subcontent {
  id: string
  user_id: string
  category: ContentCategory
  label: string
  created_at: string
}

// ─── Jugadores y asistencia ───────────────────────────────────────────────────
export interface Player {
  id: string
  user_id: string
  team_category: TeamCategory
  full_name: string
  created_at: string
}

export type AttendanceStatus = 'presente' | 'ausente' | 'lesionado'

export interface AttendanceRecord {
  id: string
  player_id: string
  date: string       // 'yyyy-MM-dd'
  turno: string       // 'Preparación física' | 'Pelota' | turno libre puntual
  status: AttendanceStatus
  created_at: string
}

// ─── Cuentas (multi-club: un club o un entrenador individual) ────────────────
export interface Account {
  id: string
  name: string
  access_code: string
  logo_url: string | null
  primary_color: string
  admin_id: string | null
  created_at: string
}
