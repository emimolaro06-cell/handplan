import { supabase } from '@/lib/supabase'
import type { Subcontent, ContentCategory } from '@/types'

// Trae todos los subcontenidos del profe logueado, opcionalmente filtrados por categoría general
export async function listSubcontents(userId: string, category?: ContentCategory): Promise<Subcontent[]> {
  let query = supabase
    .from('subcontents')
    .select('*')
    .eq('user_id', userId)
    .order('label')

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Subcontent[]
}

export async function addSubcontent(userId: string, category: ContentCategory, label: string): Promise<Subcontent> {
  const { data, error } = await supabase
    .from('subcontents')
    .insert({ user_id: userId, category, label })
    .select()
    .single()
  if (error) throw error
  return data as Subcontent
}

export async function deleteSubcontent(id: string): Promise<void> {
  const { error } = await supabase.from('subcontents').delete().eq('id', id)
  if (error) throw error
}
