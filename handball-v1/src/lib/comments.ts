import { supabase } from '@/lib/supabase'
import type { TrainingComment } from '@/types'

// Trae los comentarios de un entrenamiento puntual, con el nombre del admin que lo escribió
export async function listTrainingComments(sessionId: string): Promise<TrainingComment[]> {
  const { data, error } = await supabase
    .from('training_comments')
    .select('id, session_id, admin_id, comment, created_at, profiles(full_name)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    session_id: row.session_id,
    admin_id: row.admin_id,
    comment: row.comment,
    created_at: row.created_at,
    admin_name: row.profiles?.full_name ?? 'Coordinador',
  }))
}

export async function addTrainingComment(sessionId: string, adminId: string, comment: string) {
  const { data, error } = await supabase
    .from('training_comments')
    .insert({ session_id: sessionId, admin_id: adminId, comment })
    .select()
    .single()
  if (error) throw error
  return data as TrainingComment
}

export async function deleteTrainingComment(id: string) {
  const { error } = await supabase.from('training_comments').delete().eq('id', id)
  if (error) throw error
}
