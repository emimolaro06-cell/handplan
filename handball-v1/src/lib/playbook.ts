import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PlaybookFolder {
  id: string
  coach_id: string
  account_id: string
  name: string
  created_at: string
}

export interface PlaybookJugada {
  id: string
  coach_id: string
  account_id: string
  folder_id: string | null
  title: string
  description: string
  frames: unknown[]
  court_mode: string
  thumbnail: string
  created_at: string
  updated_at: string
}

// ─── Carpetas ─────────────────────────────────────────────────────────────────
export async function getFolders(coachId: string): Promise<PlaybookFolder[]> {
  const { data, error } = await supabase
    .from('playbook_folders')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as PlaybookFolder[]
}

export async function createFolder(
  coachId: string, accountId: string, name: string,
): Promise<PlaybookFolder> {
  const { data, error } = await supabase
    .from('playbook_folders')
    .insert({ coach_id: coachId, account_id: accountId, name: name.trim() })
    .select()
    .single()
  if (error) throw error
  return data as PlaybookFolder
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('playbook_folders')
    .update({ name: name.trim() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase
    .from('playbook_folders')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Jugadas ──────────────────────────────────────────────────────────────────
export async function getJugadas(
  coachId: string, folderId?: string | null,
): Promise<PlaybookJugada[]> {
  let q = supabase
    .from('playbook_jugadas')
    .select('*')
    .eq('coach_id', coachId)
    .order('updated_at', { ascending: false })
  if (folderId !== undefined) {
    q = folderId === null ? q.is('folder_id', null) : q.eq('folder_id', folderId)
  }
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as PlaybookJugada[]
}

export async function saveJugada(input: {
  id?: string
  coachId: string
  accountId: string
  folderId: string | null
  title: string
  description: string
  frames: unknown[]
  courtMode: string
  thumbnail: string
}): Promise<PlaybookJugada> {
  const row = {
    coach_id: input.coachId,
    account_id: input.accountId,
    folder_id: input.folderId,
    title: input.title.trim() || 'Sin título',
    description: input.description,
    frames: input.frames,
    court_mode: input.courtMode,
    thumbnail: input.thumbnail,
    updated_at: new Date().toISOString(),
  }
  if (input.id) {
    const { data, error } = await supabase
      .from('playbook_jugadas')
      .update(row)
      .eq('id', input.id)
      .select()
      .single()
    if (error) throw error
    return data as PlaybookJugada
  }
  const { data, error } = await supabase
    .from('playbook_jugadas')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as PlaybookJugada
}

export async function deleteJugada(id: string): Promise<void> {
  const { error } = await supabase
    .from('playbook_jugadas')
    .delete()
    .eq('id', id)
  if (error) throw error
}
