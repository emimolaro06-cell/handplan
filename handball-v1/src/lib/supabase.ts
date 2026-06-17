import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en .env.local'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnon)

// ─── Auth: username → email interno ─────────────────────────────────────────
// El email real nunca lo ve el entrenador.
// Se construye como: username@hbdj.internal
function toEmail(username: string) {
  return `${username.toLowerCase().trim().replace(/\s+/g, '_')}@hbdj.internal`
}

export async function signInWithUsername(username: string, password: string) {
  const email = toEmail(username)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signUpWithUsername(
  username: string,
  password: string,
  meta: { full_name: string; role: string; club_name: string; avatar_color: string }
) {
  const email = toEmail(username)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, ...meta } },
  })
  return { data, error }
}

export async function signOut() {
  return supabase.auth.signOut()
}

// ─── Profiles ────────────────────────────────────────────────────────────────
export async function getProfile(userId: string) {
  return supabase.from('profiles').select('*').eq('id', userId).single()
}

export async function updateProfile(userId: string, data: Record<string, unknown>) {
  return supabase.from('profiles').update(data).eq('id', userId).select().single()
}

export async function getAllCoaches() {
  return supabase.from('profiles').select('full_name').eq('role', 'coach').order('full_name')
}

// ─── Exercise Labels (lista desplegable personalizable) ──────────────────────
export async function getExerciseLabels() {
  return supabase.from('exercise_labels').select('*').order('label')
}

export async function addExerciseLabel(label: string, userId: string) {
  return supabase
    .from('exercise_labels')
    .insert({ label: label.trim(), created_by: userId })
    .select()
    .single()
}

export async function deleteExerciseLabel(id: string) {
  return supabase.from('exercise_labels').delete().eq('id', id)
}

// ─── Training Sessions ───────────────────────────────────────────────────────
export async function getSessions(userId: string, filters?: {
  team_category?: string
  content_category?: string
  coach_name?: string
  search?: string
}) {
  let q = supabase
    .from('training_sessions')
    .select('*, moments(*)')
    .eq('user_id', userId)
    .order('session_date', { ascending: false })

  if (filters?.team_category)    q = q.eq('team_category', filters.team_category)
  if (filters?.content_category) q = q.eq('content_category', filters.content_category)
  if (filters?.coach_name)       q = q.ilike('coach_name', `%${filters.coach_name}%`)
  if (filters?.search) {
    q = q.or(
      `general_objective.ilike.%${filters.search}%,main_content.ilike.%${filters.search}%`
    )
  }
  return q
}

export async function getSessionById(id: string) {
  return supabase
    .from('training_sessions')
    .select('*, moments(*)')
    .eq('id', id)
    .single()
}

export async function createSession(
  userId: string,
  data: Record<string, unknown>,
  moments: Record<string, unknown>[]
) {
  const { data: session, error } = await supabase
    .from('training_sessions')
    .insert({ ...data, user_id: userId, status: 'saved' })
    .select()
    .single()

  if (error || !session) return { data: null, error }

  if (moments.length > 0) {
    const rows = moments.map((m, i) => ({
      ...m,
      session_id: session.id,
      order_index: i,
    }))
    const { error: mErr } = await supabase.from('moments').insert(rows)
    if (mErr) return { data: null, error: mErr }
  }
  return { data: session, error: null }
}

export async function updateSession(
  id: string,
  data: Record<string, unknown>,
  moments: Record<string, unknown>[]
) {
  const { data: session, error } = await supabase
    .from('training_sessions')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !session) return { data: null, error }

  // Reemplazar momentos completamente
  await supabase.from('moments').delete().eq('session_id', id)
  if (moments.length > 0) {
    const rows = moments.map((m, i) => ({
      ...m,
      session_id: id,
      order_index: i,
    }))
    await supabase.from('moments').insert(rows)
  }
  return { data: session, error: null }
}

export async function duplicateSession(id: string, userId: string) {
  // Traer original con momentos
  const { data: orig, error } = await getSessionById(id)
  if (error || !orig) return { data: null, error }

  const { moments, id: _id, created_at, updated_at, ...rest } = orig as Record<string, unknown>

  const copy = {
    ...rest,
    user_id: userId,
    session_date: new Date().toISOString().split('T')[0],
    status: 'draft',
    general_objective: `Copia de ${(rest as Record<string,string>).general_objective}`,
  }

  const momentsCopy = ((moments as Record<string, unknown>[]) ?? []).map(
    ({ id: _mid, session_id: _sid, ...m }: Record<string, unknown>) => m
  )

  return createSession(userId, copy, momentsCopy)
}

export async function deleteSession(id: string) {
  return supabase.from('training_sessions').delete().eq('id', id)
}

// ─── Exercises (biblioteca) ──────────────────────────────────────────────────
export async function getExercises(category?: string) {
  let q = supabase.from('exercises').select('*').order('name')
  if (category) q = q.eq('category', category)
  return q
}

export async function createExercise(data: Record<string, unknown>) {
  return supabase.from('exercises').insert(data).select().single()
}

export async function deleteExercise(id: string) {
  return supabase.from('exercises').delete().eq('id', id)
}

// ─── Storage: subida de imágenes ─────────────────────────────────────────────
export async function uploadImage(
  bucket: 'exercises' | 'moments',
  file: File
): Promise<{ url: string | null; error: Error | null }> {
  const ext  = file.name.split('.').pop() ?? 'png'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return { url: null, error }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

// ─── Compartir entrenamientos ─────────────────────────────────────────────────
export async function createShareLink(sessionId: string) {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const { data, error } = await supabase
    .from('shared_sessions')
    .insert({ session_id: sessionId, token, expires_at: null })
    .select()
    .single()
  return { token: (data as { token: string } | null)?.token ?? null, error }
}

export async function getSharedSession(token: string) {
  const { data, error } = await supabase
    .from('shared_sessions')
    .select('session_id')
    .eq('token', token)
    .single()
  if (error || !data) return { data: null, error }
  return getSessionById((data as { session_id: string }).session_id)
}
