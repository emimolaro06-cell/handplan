import { supabase } from '@/lib/supabase'

export interface ExerciseFolder {
  id: string
  created_by: string
  account_id: string
  name: string
  created_at: string
}

export async function getExerciseFolders(userId: string): Promise<ExerciseFolder[]> {
  const { data, error } = await supabase
    .from('exercise_folders')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ExerciseFolder[]
}

export async function createExerciseFolder(
  userId: string, accountId: string, name: string,
): Promise<ExerciseFolder> {
  const { data, error } = await supabase
    .from('exercise_folders')
    .insert({ created_by: userId, account_id: accountId, name: name.trim() })
    .select()
    .single()
  if (error) throw error
  return data as ExerciseFolder
}

export async function deleteExerciseFolder(id: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_folders')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function moveExerciseToFolder(
  exerciseId: string, folderId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('exercises')
    .update({ folder_id: folderId })
    .eq('id', exerciseId)
  if (error) throw error
}
