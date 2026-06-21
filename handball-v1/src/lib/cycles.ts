import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, startOfWeek, addDays } from 'date-fns'
import type {
  Macrocycle, MicrocycleDay, MicrocycleMoment, SharedMicrocycle,
  TeamCategory, ContentCategory, ContentCategoryStats,
} from '@/types'

// ════════════════════════════════════════════════════════════════════════════
// MACROCICLOS
// ════════════════════════════════════════════════════════════════════════════

export async function getOrCreateMacrocycle(userId: string, teamCategory: TeamCategory) {
  const { data: existing, error: selectError } = await supabase
    .from('macrocycles')
    .select('*')
    .eq('user_id', userId)
    .eq('team_category', teamCategory)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing as Macrocycle

  const { data: created, error: insertError } = await supabase
    .from('macrocycles')
    .insert({
      user_id: userId,
      team_category: teamCategory,
      name: `Temporada ${new Date().getFullYear()}`,
      start_date: format(new Date(), 'yyyy-MM-dd'),
    })
    .select()
    .single()
  if (insertError) throw insertError
  return created as Macrocycle
}

export async function updateMacrocycle(id: string, patch: Partial<Macrocycle>) {
  const { data, error } = await supabase
    .from('macrocycles')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Macrocycle
}

// ════════════════════════════════════════════════════════════════════════════
// DÍAS DEL MICROCICLO
// ════════════════════════════════════════════════════════════════════════════

export async function listDaysInMonth(macrocycleId: string, refDate: Date) {
  const start = format(startOfMonth(refDate), 'yyyy-MM-dd')
  const end   = format(endOfMonth(refDate), 'yyyy-MM-dd')
  const { data, error } = await supabase
    .from('microcycle_days')
    .select('*')
    .eq('macrocycle_id', macrocycleId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
  if (error) throw error
  return (data ?? []) as MicrocycleDay[]
}

export async function listDaysInWeek(macrocycleId: string, weekStart: Date) {
  const start = format(weekStart, 'yyyy-MM-dd')
  const end   = format(addDays(weekStart, 6), 'yyyy-MM-dd')
  const { data, error } = await supabase
    .from('microcycle_days')
    .select('*')
    .eq('macrocycle_id', macrocycleId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
  if (error) throw error
  return (data ?? []) as MicrocycleDay[]
}

export async function listAllDays(macrocycleId: string) {
  const { data, error } = await supabase
    .from('microcycle_days')
    .select('*')
    .eq('macrocycle_id', macrocycleId)
  if (error) throw error
  return (data ?? []) as MicrocycleDay[]
}

export async function upsertMicrocycleDay(input: {
  macrocycle_id: string
  date: string
  labels: string[]
  rival_logo_url?: string | null
  moments: MicrocycleMoment[]
}) {
  const { data, error } = await supabase
    .from('microcycle_days')
    .upsert(
      {
        macrocycle_id: input.macrocycle_id,
        date: input.date,
        labels: input.labels,
        rival_logo_url: input.rival_logo_url ?? null,
        moments: input.moments,
      },
      { onConflict: 'macrocycle_id,date' },
    )
    .select()
    .single()
  if (error) throw error
  return data as MicrocycleDay
}

// ════════════════════════════════════════════════════════════════════════════
// IMAGEN DEL DÍA — subida al bucket 'microcycles' de Storage
// ════════════════════════════════════════════════════════════════════════════

export async function uploadDayImage(file: File, macrocycleId: string, date: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const timestamp = Date.now()
  const path = `${macrocycleId}/${date}_${timestamp}.${ext}`

  // Borrar archivos viejos del mismo día antes de subir el nuevo
  const { data: existing } = await supabase.storage
    .from('microcycles')
    .list(macrocycleId, { search: date })
  if (existing && existing.length > 0) {
    const oldPaths = existing.map(f => `${macrocycleId}/${f.name}`)
    await supabase.storage.from('microcycles').remove(oldPaths)
  }

  const { error: uploadError } = await supabase.storage
    .from('microcycles')
    .upload(path, file)
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('microcycles').getPublicUrl(path)
  // Agrega un cache-buster para que el navegador no muestre la imagen vieja
  return data.publicUrl + `?t=${timestamp}`
}

export async function deleteDayImage(macrocycleId: string, date: string, ext: string) {
  const path = `${macrocycleId}/${date}.${ext}`
  await supabase.storage.from('microcycles').remove([path])
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS DE MOMENTOS
// ════════════════════════════════════════════════════════════════════════════

export function newMoment(content = '', category: ContentCategory | null = null): MicrocycleMoment {
  return { id: crypto.randomUUID(), order: 0, content, category, subcontent_id: null }
}

export function addMomentToDay(moments: MicrocycleMoment[], content = ''): MicrocycleMoment[] {
  const m = newMoment(content)
  return [...moments, { ...m, order: moments.length }]
}

export function removeMomentFromDay(moments: MicrocycleMoment[], momentId: string): MicrocycleMoment[] {
  return moments
    .filter(m => m.id !== momentId)
    .map((m, i) => ({ ...m, order: i }))
}

export function updateMomentContent(
  moments: MicrocycleMoment[], momentId: string, content: string,
): MicrocycleMoment[] {
  return moments.map(m => (m.id === momentId ? { ...m, content } : m))
}

export function updateMomentCategory(
  moments: MicrocycleMoment[], momentId: string, category: ContentCategory | null,
): MicrocycleMoment[] {
  // Al cambiar de categoría general, se limpia el subcontenido (pertenecía a la categoría anterior)
  return moments.map(m => (m.id === momentId ? { ...m, category, subcontent_id: null } : m))
}

export function updateMomentSubcontent(
  moments: MicrocycleMoment[], momentId: string, subcontentId: string | null,
): MicrocycleMoment[] {
  return moments.map(m => (m.id === momentId ? { ...m, subcontent_id: subcontentId } : m))
}

// ════════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS — combina Momentos de Microciclos + Momentos de Entrenamientos
// ════════════════════════════════════════════════════════════════════════════

const EMPTY_STATS: ContentCategoryStats = {
  'Técnica individual OFENSIVA': 0,
  'Técnica individual DEFENSIVA': 0,
  'Táctica OFENSIVA': 0,
  'Táctica DEFENSIVA': 0,
  'MIXTO': 0,
}

// Un "momento contado" genérico, sea que venga de un microciclo o de un entrenamiento
export interface CountedMoment {
  category: ContentCategory
  subcontent_id: string | null
}

// Trae los entrenamientos guardados del coach, cuya fecha cae dentro del macrociclo,
// y devuelve sus Momentos que tengan categoría general asignada.
export async function listTrainingMomentsForMacrocycle(userId: string): Promise<CountedMoment[]> {
  const { data: sessions, error } = await supabase
    .from('training_sessions')
    .select('id, moments(content_category, subcontent_id)')
    .eq('user_id', userId)
    .eq('status', 'saved')
  if (error) throw error

  const result: CountedMoment[] = []
  for (const session of (sessions ?? []) as any[]) {
    for (const m of session.moments ?? []) {
      if (m.content_category) {
        result.push({ category: m.content_category, subcontent_id: m.subcontent_id ?? null })
      }
    }
  }
  return result
}

// Convierte los días de microciclos a la misma forma genérica que los de entrenamientos
function microcycleDaysToCountedMoments(days: MicrocycleDay[]): CountedMoment[] {
  const result: CountedMoment[] = []
  for (const day of days) {
    for (const moment of day.moments) {
      if (moment.category) {
        result.push({ category: moment.category, subcontent_id: moment.subcontent_id ?? null })
      }
    }
  }
  return result
}

// Stats para el gráfico de RADAR (las 5 categorías generales), combinando ambas fuentes
export function computeContentStats(days: MicrocycleDay[], trainingMoments: CountedMoment[] = []): ContentCategoryStats {
  const stats: ContentCategoryStats = { ...EMPTY_STATS }
  const all = [...microcycleDaysToCountedMoments(days), ...trainingMoments]
  for (const m of all) {
    stats[m.category] = (stats[m.category] ?? 0) + 1
  }
  return stats
}

// Stats para el gráfico de TORTA: desglose de subcontenidos dentro de UNA categoría puntual
export interface SubcontentStat {
  subcontent_id: string | null
  count: number
}

export function computeSubcontentStats(
  days: MicrocycleDay[], trainingMoments: CountedMoment[], category: ContentCategory,
): SubcontentStat[] {
  const all = [...microcycleDaysToCountedMoments(days), ...trainingMoments]
  const counts = new Map<string | null, number>()
  for (const m of all) {
    if (m.category !== category) continue
    const key = m.subcontent_id
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([subcontent_id, count]) => ({ subcontent_id, count }))
}

// ════════════════════════════════════════════════════════════════════════════
// SEMANAS DEL MES
// ════════════════════════════════════════════════════════════════════════════

export interface WeekInMonth {
  weekStart: Date
  weekEnd: Date
  label: string
}

export function getWeeksInMonth(refDate: Date): WeekInMonth[] {
  const monthStart = startOfMonth(refDate)
  const monthEnd = endOfMonth(refDate)
  const weeks: WeekInMonth[] = []

  let cursor = startOfWeek(monthStart, { weekStartsOn: 1 })
  while (cursor <= monthEnd) {
    const weekEnd = addDays(cursor, 6)
    weeks.push({
      weekStart: cursor,
      weekEnd,
      label: `${format(cursor, 'd')} – ${format(weekEnd, 'd MMM')}`,
    })
    cursor = addDays(cursor, 7)
  }
  return weeks
}

// ════════════════════════════════════════════════════════════════════════════
// COMPARTIR MICROCICLO
// ════════════════════════════════════════════════════════════════════════════

export async function getOrCreateShareLink(
  macrocycleId: string, weekStartDate: string, userId: string,
) {
  const { data: existing, error: selectError } = await supabase
    .from('shared_microcycles')
    .select('*')
    .eq('macrocycle_id', macrocycleId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing as SharedMicrocycle

  const { data: created, error: insertError } = await supabase
    .from('shared_microcycles')
    .insert({ macrocycle_id: macrocycleId, week_start_date: weekStartDate, created_by: userId })
    .select()
    .single()
  if (insertError) throw insertError
  return created as SharedMicrocycle
}

export async function getSharedMicrocycleByToken(token: string) {
  const { data: shared, error } = await supabase
    .from('shared_microcycles')
    .select('*')
    .eq('token', token)
    .single()
  if (error) throw error
  return shared as SharedMicrocycle
}

export function buildShareUrl(token: string) {
  return `${window.location.origin}/microciclo-compartido/${token}`
}
