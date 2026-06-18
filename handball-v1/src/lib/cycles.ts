import { supabase } from '@/lib/supabase'
import type {
  Macrocycle, Mesocycle, Microcycle, MicrocycleDay, MicrocycleMoment, TeamCategory,
} from '@/types'

// ════════════════════════════════════════════════════════════════════════════
// MACROCICLOS
// ════════════════════════════════════════════════════════════════════════════

export async function listMacrocycles(userId: string, teamCategory: TeamCategory) {
  const { data, error } = await supabase
    .from('macrocycles')
    .select('*')
    .eq('user_id', userId)
    .eq('team_category', teamCategory)
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as Macrocycle[]
}

export async function createMacrocycle(input: {
  user_id: string
  team_category: TeamCategory
  name: string
  start_date: string
  end_date?: string | null
  objective?: string | null
}) {
  const { data, error } = await supabase
    .from('macrocycles')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as Macrocycle
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

export async function deleteMacrocycle(id: string) {
  const { error } = await supabase.from('macrocycles').delete().eq('id', id)
  if (error) throw error
}

// ════════════════════════════════════════════════════════════════════════════
// MESOCICLOS
// ════════════════════════════════════════════════════════════════════════════

export async function listMesocycles(macrocycleId: string) {
  const { data, error } = await supabase
    .from('mesocycles')
    .select('*')
    .eq('macrocycle_id', macrocycleId)
    .order('number', { ascending: true })
  if (error) throw error
  return (data ?? []) as Mesocycle[]
}

// No se pasa "number": lo asigna solo el trigger autonumerador en Supabase.
export async function createMesocycle(input: {
  macrocycle_id: string
  name?: string | null
  objective?: string | null
  start_date?: string | null
  end_date?: string | null
}) {
  const { data, error } = await supabase
    .from('mesocycles')
    .insert({ ...input, number: null })
    .select()
    .single()
  if (error) throw error
  return data as Mesocycle
}

export async function updateMesocycle(id: string, patch: Partial<Mesocycle>) {
  const { data, error } = await supabase
    .from('mesocycles')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Mesocycle
}

export async function deleteMesocycle(id: string) {
  const { error } = await supabase.from('mesocycles').delete().eq('id', id)
  if (error) throw error
}

// ════════════════════════════════════════════════════════════════════════════
// MICROCICLOS
// ════════════════════════════════════════════════════════════════════════════

export async function listMicrocycles(mesocycleId: string) {
  const { data, error } = await supabase
    .from('microcycles')
    .select('*')
    .eq('mesocycle_id', mesocycleId)
    .order('number', { ascending: true })
  if (error) throw error
  return (data ?? []) as Microcycle[]
}

export async function getMicrocycle(id: string) {
  const { data, error } = await supabase
    .from('microcycles')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Microcycle
}

// No se pasa "number": lo asigna solo el trigger autonumerador en Supabase.
// week_start_date debe ser el Lunes de la semana ('yyyy-MM-dd').
export async function createMicrocycle(input: {
  mesocycle_id: string
  week_start_date: string
  objective?: string | null
}) {
  const { data, error } = await supabase
    .from('microcycles')
    .insert({ ...input, number: null })
    .select()
    .single()
  if (error) throw error
  return data as Microcycle
}

export async function updateMicrocycle(id: string, patch: Partial<Microcycle>) {
  const { data, error } = await supabase
    .from('microcycles')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Microcycle
}

export async function deleteMicrocycle(id: string) {
  const { error } = await supabase.from('microcycles').delete().eq('id', id)
  if (error) throw error
}

// ════════════════════════════════════════════════════════════════════════════
// DÍAS DEL MICROCICLO
// ════════════════════════════════════════════════════════════════════════════

export async function listMicrocycleDays(microcycleId: string) {
  const { data, error } = await supabase
    .from('microcycle_days')
    .select('*')
    .eq('microcycle_id', microcycleId)
    .order('date', { ascending: true })
  if (error) throw error
  return (data ?? []) as MicrocycleDay[]
}

// Crea o actualiza el día (upsert por la UNIQUE(microcycle_id, date)).
export async function upsertMicrocycleDay(input: {
  microcycle_id: string
  date: string                 // 'yyyy-MM-dd'
  day_label?: string | null
  rival_logo_url?: string | null
  moments: MicrocycleMoment[]
}) {
  const { data, error } = await supabase
    .from('microcycle_days')
    .upsert(
      {
        microcycle_id: input.microcycle_id,
        date: input.date,
        day_label: input.day_label ?? null,
        rival_logo_url: input.rival_logo_url ?? null,
        moments: input.moments,
      },
      { onConflict: 'microcycle_id,date' },
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

export function newMoment(content = ''): MicrocycleMoment {
  return { id: crypto.randomUUID(), order: 0, content }
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

export function reorderMoments(
  moments: MicrocycleMoment[], fromIndex: number, toIndex: number,
): MicrocycleMoment[] {
  const sorted = [...moments].sort((a, b) => a.order - b.order)
  const [moved] = sorted.splice(fromIndex, 1)
  sorted.splice(toIndex, 0, moved)
  return sorted.map((m, i) => ({ ...m, order: i }))
}
