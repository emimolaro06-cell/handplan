import { useEffect, useState } from 'react'
import { supabase, getProfile } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'

export function useAuth() {
  const { profile, setProfile } = useAppStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sesión inicial al cargar
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await getProfile(session.user.id)
        if (data) setProfile(data)
      }
      setLoading(false)
    })

    // Escuchar cambios
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const { data } = await getProfile(session.user.id)
          if (data) setProfile(data)
        } else {
          setProfile(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [setProfile])

  return { profile, loading }
}
