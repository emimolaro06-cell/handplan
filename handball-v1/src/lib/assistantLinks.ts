import { supabase } from '@/lib/supabase'

export interface AssistantLink {
  id: string
  assistant_id: string
  coach_id: string
  created_at: string
}

// Trae el AT vinculado a este coach (si tiene uno), con su nombre completo
export async function getMyAssistant(coachId: string) {
  const { data: link, error } = await supabase
    .from('assistant_links')
    .select('*')
    .eq('coach_id', coachId)
    .maybeSingle()
  if (error) throw error
  if (!link) return null

  const { data: assistantProfile } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', link.assistant_id)
    .single()

  return { link: link as AssistantLink, assistantName: assistantProfile?.full_name ?? null }
}

// Vincula un perfil EXISTENTE (por username) como Ayudante Técnico de este coach
export async function linkAssistantByUsername(coachId: string, username: string) {
  const { data: assistantProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username.trim())
    .single()
  if (profileError || !assistantProfile) {
    throw new Error('No se encontró un perfil con ese nombre de usuario.')
  }

  const { data, error } = await supabase
    .from('assistant_links')
    .insert({ assistant_id: assistantProfile.id, coach_id: coachId })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('Ese usuario ya es Ayudante Técnico de otro coach.')
    }
    throw error
  }
  return data as AssistantLink
}

export async function unlinkAssistant(linkId: string) {
  const { error } = await supabase.from('assistant_links').delete().eq('id', linkId)
  if (error) throw error
}
