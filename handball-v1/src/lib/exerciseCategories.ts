import { supabase } from '@/lib/supabase'

export async function getExerciseCategories() {
  return supabase.from('exercise_categories').select('*').order('category')
}

export async function addExerciseCategory(category: string, userId: string, accountId: string) {
  return supabase
    .from('exercise_categories')
    .insert({ category: category.trim(), created_by: userId, account_id: accountId })
    .select()
    .single()
}

export async function deleteExerciseCategory(id: string) {
  return supabase.from('exercise_categories').delete().eq('id', id)
}
