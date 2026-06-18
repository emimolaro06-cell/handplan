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
// DÍAS DEL MICROCICLO (dependen directo de macrocycle_id + date)
// ════════════════════════════════════════════════════════════════════════════

// Trae todos los días de un mes calendario (Mesociclo = mes automático)
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

// Trae los días de una semana puntual (Microciclo = semana Lun-Dom)
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

// Trae TODOS los días del macrociclo (para la estadística anual de contenidos)
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
  date: string                 // 'yyyy-MM-dd'
  day_label?: string | null
  rival_logo_url?: string | null
  moments: MicrocycleMoment[]
}) {
  const { data, error } = await supabase
    .from('microcycle_days')
    .upsert(
      {
        macrocycle_id: input.macrocycle_id,
        date: input.date,
        day_label: input.day_label ?? null,
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

export async function deleteMicrocycleDay(id: string) {
  const { error } = await supabase.from('microcycle_days').delete().eq('id', id)
  if (error) throw error
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS DE MOMENTOS (array variable dentro de un día — JSON, no tabla)
// ════════════════════════════════════════════════════════════════════════════

export function newMoment(content = '', category: ContentCategory | null = null): MicrocycleMoment {
  return { id: crypto.randomUUID(), order: 0, content, category }
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
  return moments.map(m => (m.id === momentId ? { ...m, category } : m))
}

export function reorderMoments(
  moments: MicrocycleMoment[], fromIndex: number, toIndex: number,
): MicrocycleMoment[] {
  const sorted = [...moments].sort((a, b) => a.order - b.order)
  const [moved] = sorted.splice(fromIndex, 1)
  sorted.splice(toIndex, 0, moved)
  return sorted.map((m, i) => ({ ...m, order: i }))
}

// ════════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS — conteo de categorías para el gráfico de radar anual
// ════════════════════════════════════════════════════════════════════════════

const EMPTY_STATS: ContentCategoryStats = {
  'Técnica individual OFENSIVA': 0,
  'Técnica individual DEFENSIVA': 0,
  'Táctica OFENSIVA': 0,
  'Táctica DEFENSIVA': 0,
  'MIXTO': 0,
}

export function computeContentStats(days: MicrocycleDay[]): ContentCategoryStats {
  const stats: ContentCategoryStats = { ...EMPTY_STATS }
  for (const day of days) {
    for (const moment of day.moments) {
      if (moment.category) {
        stats[moment.category] = (stats[moment.category] ?? 0) + 1
      }
    }
  }
  return stats
}

// ════════════════════════════════════════════════════════════════════════════
// SEMANAS DEL MES (para listar microciclos clickeables en el calendario)
// ════════════════════════════════════════════════════════════════════════════

export interface WeekInMonth {
  weekStart: Date
  weekEnd: Date
  label: string // ej: "1 - 7 jun"
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
// COMPARTIR MICROCICLO (link público de solo lectura)
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
