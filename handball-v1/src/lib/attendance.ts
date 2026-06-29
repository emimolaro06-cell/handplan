import { supabase } from '@/lib/supabase'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import type { Player, AttendanceRecord, AttendanceStatus, TeamCategory } from '@/types'

// ════════════════════════════════════════════════════════════════════════════
// JUGADORES
// ════════════════════════════════════════════════════════════════════════════

export async function listPlayers(userId: string, teamCategory: TeamCategory): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .eq('team_category', teamCategory)
    .order('full_name')
  if (error) throw error
  return (data ?? []) as Player[]
}

export async function addPlayer(
  userId: string, teamCategory: TeamCategory, fullName: string, accountId?: string | null,
): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({ user_id: userId, team_category: teamCategory, full_name: fullName.trim(), account_id: accountId })
    .select()
    .single()
  if (error) throw error
  return data as Player
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}

// ════════════════════════════════════════════════════════════════════════════
// ASISTENCIA — por turno (Preparación física / Pelota / turno libre puntual)
// ════════════════════════════════════════════════════════════════════════════

// Trae TODOS los registros de un turno puntual, para los jugadores dados, dentro de un rango de fechas
export async function getAttendanceForTurnoInRange(
  playerIds: string[], turno: string, startDate: string, endDate: string,
): Promise<AttendanceRecord[]> {
  if (playerIds.length === 0) return []
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .in('player_id', playerIds)
    .eq('turno', turno)
    .gte('date', startDate)
    .lte('date', endDate)
  if (error) throw error
  return (data ?? []) as AttendanceRecord[]
}

// Trae los registros de TODOS los turnos para los jugadores dados, dentro de un rango (para el resumen combinado)
export async function getAttendanceInRange(
  playerIds: string[], startDate: string, endDate: string,
): Promise<AttendanceRecord[]> {
  if (playerIds.length === 0) return []
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .in('player_id', playerIds)
    .gte('date', startDate)
    .lte('date', endDate)
  if (error) throw error
  return (data ?? []) as AttendanceRecord[]
}

// Marca el estado (presente/ausente/lesionado) de un jugador, en una fecha y turno puntual
// upsert por la UNIQUE(player_id, date, turno)
export async function setAttendanceStatus(
  playerId: string, date: string, turno: string, status: AttendanceStatus,
): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .upsert({ player_id: playerId, date, turno, status }, { onConflict: 'player_id,date,turno' })
  if (error) throw error
}

// Quita la marca de un jugador en una fecha y turno (vuelve a "sin registrar")
export async function clearAttendanceStatus(playerId: string, date: string, turno: string): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('player_id', playerId)
    .eq('date', date)
    .eq('turno', turno)
  if (error) throw error
}

// Lista los turnos puntuales (no fijos) que ya tienen al menos un registro en el rango dado
// — para mostrar columnas extra que el coach haya agregado en el mes
export async function listExtraTurnosInRange(
  playerIds: string[], startDate: string, endDate: string, fixedShifts: readonly string[],
): Promise<string[]> {
  if (playerIds.length === 0) return []
  const { data, error } = await supabase
    .from('attendance')
    .select('turno')
    .in('player_id', playerIds)
    .gte('date', startDate)
    .lte('date', endDate)
  if (error) throw error
  const all = ((data ?? []) as { turno: string }[]).map(r => r.turno)
  return Array.from(new Set(all)).filter(t => !fixedShifts.includes(t))
}

// ════════════════════════════════════════════════════════════════════════════
// RESUMEN — porcentaje de asistencia por jugador
// ════════════════════════════════════════════════════════════════════════════

export interface PlayerAttendanceSummary {
  player: Player
  totalDays: number     // registros que cuentan para el cálculo (presente + ausente, sin lesionado)
  presentDays: number
  percentage: number    // 0-100
}

// computa el resumen para UN turno (o varios turnos mezclados, según los records que se le pasen)
// Lesionado se excluye del cálculo: no suma ni resta.
export function computeAttendanceSummary(
  players: Player[], records: AttendanceRecord[],
): PlayerAttendanceSummary[] {
  return players.map(player => {
    const playerRecords = records.filter(r => r.player_id === player.id && r.status !== 'lesionado')
    const totalDays = playerRecords.length
    const presentDays = playerRecords.filter(r => r.status === 'presente').length
    const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0
    return { player, totalDays, presentDays, percentage }
  })
}

export function getMonthRange(refDate: Date) {
  return {
    start: format(startOfMonth(refDate), 'yyyy-MM-dd'),
    end: format(endOfMonth(refDate), 'yyyy-MM-dd'),
  }
}
