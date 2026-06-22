import { supabase } from '@/lib/supabase'
import type { Account } from '@/types'

export async function findAccountByCode(code: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .ilike('access_code', code.trim())
    .maybeSingle()
  if (error) throw error
  return data as Account | null
}

export async function getAccountById(id: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Account | null
}
