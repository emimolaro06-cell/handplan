import { supabase } from '@/lib/supabase'
import type { Account } from '@/types'

export async function findAccountByCode(code: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts_public')
    .select('*')
    .ilike('access_code', code.trim())
    .maybeSingle()
  if (error) throw error
  return data as Account | null
}

export async function getAccountById(id: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts_public')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Account | null
}

// ─── Etapa 4: solicitud de alta de cuenta nueva (autogestionada, pendiente de aprobación) ──

export interface CreateAccountRequest {
  name: string
  access_code: string
  primary_color: string
  logo_url: string | null
  admin_full_name: string
  admin_username: string
  admin_password: string
}

// Antes de insertar, confirma que el código de acceso no esté en uso por ninguna cuenta
// (activa o pendiente) — devuelve true si está libre.
export async function isAccessCodeAvailable(code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('accounts_public')
    .select('id')
    .ilike('access_code', code.trim())
    .maybeSingle()
  if (error) throw error
  return data === null
}

// Crea la solicitud de cuenta nueva. El status queda forzado a 'pending' por un trigger
// en la base, sin importar lo que se mande acá — es una garantía a nivel de servidor,
// no solo de este código.
export async function createAccountRequest(req: CreateAccountRequest): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('accounts').insert({
    name: req.name.trim(),
    access_code: req.access_code.trim(),
    primary_color: req.primary_color,
    logo_url: req.logo_url,
    pending_admin_name: req.admin_full_name.trim(),
    pending_admin_username: req.admin_username.trim(),
    pending_admin_password: req.admin_password,
  })
  return { error }
}
