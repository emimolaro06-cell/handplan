import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'

// ─── Días fijos de la semana para un turno ────────────────────────────────────
// week_days: array de enteros 0-6 (0=Domingo, 1=Lunes, ..., 6=Sábado)

export async function getWeekDays(
  coachId: string, teamCategory: string, turno: string,
): Promise<number[]> {
  const { data } = await supabase
    .from('attendance_headers')
    .select('week_days')
    .eq('coach_id', coachId)
    .eq('team_category', teamCategory)
    .eq('turno', turno)
    .maybeSingle()
  return (data?.week_days ?? []) as number[]
}

export async function saveWeekDays(
  coachId: string, teamCategory: string, turno: string, weekDays: number[],
): Promise<void> {
  const { error } = await supabase
    .from('attendance_headers')
    .upsert(
      { coach_id: coachId, team_category: teamCategory, turno, week_days: weekDays, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id,team_category,turno' },
    )
  if (error) throw error
}

// Genera todas las fechas del mes que caen en los días de semana dados
export function getDatesForWeekDays(refMonth: Date, weekDays: number[]): string[] {
  if (weekDays.length === 0) return []
  const dates: string[] = []
  const current = new Date(startOfMonth(refMonth))
  const end = endOfMonth(refMonth)
  while (current <= end) {
    if (weekDays.includes(current.getDay())) {
      dates.push(format(current, 'yyyy-MM-dd'))
    }
    current.setDate(current.getDate() + 1)
  }
  return dates
}

// ─── sRPE (Session Rating of Perceived Exertion) ─────────────────────────────
// Fórmula: PSE × Duración
// Duración:
//   Físico ✅ + Pelota ✅ → 120 min
//   Solo Físico ✅          → 60 min
//   Solo Pelota ✅          → 60 min
//   Ninguno                 → 0 min

export interface SRPEData {
  pse: number | null
  duration: number
  srpe: number
}

export function computeSRPE(
  playerId: string,
  date: string,
  fisicoRecords: { player_id: string; date: string; status: string; pse?: number | null }[],
  pelotaRecords: { player_id: string; date: string; status: string; pse?: number | null }[],
): SRPEData {
  const fisico = fisicoRecords.find(r => r.player_id === playerId && r.date === date)
  const pelota = pelotaRecords.find(r => r.player_id === playerId && r.date === date)
  const attendedFisico = fisico?.status === 'presente'
  const attendedPelota = pelota?.status === 'presente'
  if (!attendedFisico && !attendedPelota) return { pse: null, duration: 0, srpe: 0 }
  const duration = attendedFisico && attendedPelota ? 120 : 60
  // PSE: primero del registro de Físico, si no del de Pelota
  const pse = fisico?.pse ?? pelota?.pse ?? null
  const srpe = pse != null ? pse * duration : 0
  return { pse, duration, srpe }
}

// ─── Color por nivel de PSE ───────────────────────────────────────────────────
export function pseColorClass(pse: number): string {
  if (pse <= 5) return 'bg-green-100 text-green-800'
  if (pse === 6) return 'bg-yellow-100 text-yellow-800'
  if (pse <= 8) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

export function pseChartColor(pse: number): string {
  if (pse <= 5) return '#639922'
  if (pse === 6) return '#f59e0b'
  if (pse <= 8) return '#f97316'
  return '#e34948'
}

export const WEEK_DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
export const WEEK_DAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
