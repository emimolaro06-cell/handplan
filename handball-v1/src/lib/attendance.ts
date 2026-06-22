import { supabase } from '@/lib/supabase'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import type { Player, AttendanceRecord, TeamCategory } from '@/types'

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

export async function addPlayer(userId: string, teamCategory: TeamCategory, fullName: string): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({ user_id: userId, team_category: teamCategory, full_name: fullName.trim() })
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
// ASISTENCIA
// ════════════════════════════════════════════════════════════════════════════

// Trae los registros de asistencia de una fecha puntual, para los jugadores dados
export async function getAttendanceForDate(playerIds: string[], date: string): Promise<AttendanceRecord[]> {
  if (playerIds.length === 0) return []
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .in('player_id', playerIds)
    .eq('date', date)
  if (error) throw error
  return (data ?? []) as AttendanceRecord[]
}

// Marca presente/ausente para un jugador en una fecha (upsert por la UNIQUE(player_id, date))
export async function setAttendance(playerId: string, date: string, present: boolean): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .upsert({ player_id: playerId, date, present }, { onConflict: 'player_id,date' })
  if (error) throw error
}

// Trae TODOS los registros de asistencia de los jugadores dados, dentro de un rango de fechas (para el resumen)
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

// ════════════════════════════════════════════════════════════════════════════
// RESUMEN — porcentaje de asistencia por jugador
// ════════════════════════════════════════════════════════════════════════════

export interface PlayerAttendanceSummary {
  player: Player
  totalDays: number
  presentDays: number
  percentage: number // 0-100
}

export function computeAttendanceSummary(
  players: Player[], records: AttendanceRecord[],
): PlayerAttendanceSummary[] {
  return players.map(player => {
    const playerRecords = records.filter(r => r.player_id === player.id)
    const totalDays = playerRecords.length
    const presentDays = playerRecords.filter(r => r.present).length
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
