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

// Actualiza el PSE de un registro de asistencia que YA existe (el jugador ya fue marcado
// presente ese día/turno — el PSE no crea una fila nueva, solo completa una existente).
export async function setAttendancePSE(playerId: string, date: string, turno: string, pse: number | null): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .update({ pse })
    .eq('player_id', playerId)
    .eq('date', date)
    .eq('turno', turno)
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

// ════════════════════════════════════════════════════════════════════════════
// ENCABEZADO DE ASISTENCIA — nombre de entrenador/preparador y asistente técnico,
// persistido por categoría + turno (compartido entre quien lo edite: coach, AT o preparador)
// ════════════════════════════════════════════════════════════════════════════

export interface AttendanceHeader {
  id: string
  coach_id: string
  team_category: string
  turno: string
  coach_name: string
  assistant_name: string
  updated_at: string
}

export async function getAttendanceHeader(
  coachId: string, teamCategory: string, turno: string,
): Promise<{ coach_name: string; assistant_name: string }> {
  const { data, error } = await supabase
    .from('attendance_headers')
    .select('coach_name, assistant_name')
    .eq('coach_id', coachId)
    .eq('team_category', teamCategory)
    .eq('turno', turno)
    .maybeSingle()
  if (error || !data) return { coach_name: '', assistant_name: '' }
  return data as { coach_name: string; assistant_name: string }
}

export async function saveAttendanceHeader(
  coachId: string, teamCategory: string, turno: string,
  fields: { coach_name: string; assistant_name: string },
): Promise<void> {
  // El upsert reemplaza la fila completa en caso de conflicto, así que siempre se manda
  // el par completo (coach_name + assistant_name) — el llamador es responsable de
  // combinar el valor que cambió con el que ya tenía antes.
  const { error } = await supabase
    .from('attendance_headers')
    .upsert(
      { coach_id: coachId, team_category: teamCategory, turno, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id,team_category,turno' },
    )
  if (error) throw error
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTAR A EXCEL — un archivo con una hoja por turno (Pelota, Preparación física)
// ════════════════════════════════════════════════════════════════════════════

const STATUS_LETTER: Record<AttendanceStatus, string> = {
  presente: 'P', ausente: 'A', lesionado: 'L',
}

export async function downloadAttendanceExcel(input: {
  category: string
  monthLabel: string         // ej: "Junio 2026", para el nombre del archivo
  players: Player[]
  sheets: {
    turno: string             // nombre visible de la hoja (ej: "Pelota", "Preparación física")
    coachName: string
    assistantName: string
    days: string[]            // 'yyyy-MM-dd', ya ordenados
    records: AttendanceRecord[]
    includePSE: boolean
  }[]
}): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  for (const sheet of input.sheets) {
    const rows: (string | number)[][] = []

    rows.push([input.category])
    rows.push([`Entrenador / Preparador: ${sheet.coachName || '—'}`])
    rows.push([`Asistente técnico: ${sheet.assistantName || '—'}`])
    rows.push([])

    const header = ['Jugador']
    sheet.days.forEach(d => {
      header.push(d)
      if (sheet.includePSE) header.push('PSE')
    })
    rows.push(header)

    input.players.forEach(player => {
      const row: (string | number)[] = [player.full_name]
      sheet.days.forEach(d => {
        const rec = sheet.records.find(r => r.player_id === player.id && r.date === d)
        row.push(rec ? STATUS_LETTER[rec.status] : '')
        if (sheet.includePSE) row.push(rec?.pse ?? '')
      })
      rows.push(row)
    })

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, ...sheet.days.flatMap(() => sheet.includePSE ? [{ wch: 10 }, { wch: 6 }] : [{ wch: 10 }])]
    XLSX.utils.book_append_sheet(wb, ws, sheet.turno.slice(0, 31))
  }

  const fileName = `asistencia_${input.category.replace(/\s+/g, '_')}_${input.monthLabel.replace(/\s+/g, '_')}.xlsx`
  XLSX.writeFile(wb, fileName)
}
