import { useEffect, useState } from 'react'
import { supabase, getProfile } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'

// Resuelve, para el usuario logueado, qué user_id debe usarse para leer/escribir datos:
// - Si NO es un Ayudante Técnico vinculado: su propio id (caso normal, coach trabajando con lo suyo).
// - Si SÍ es un AT vinculado a un coach: el id del coach (así opera sobre los mismos datos).
// También devuelve las categorías de equipo a mostrar (las del coach, si es un AT).
async function resolveEffectiveUser(userId: string, ownCategories: string[]) {
  const { data: link } = await supabase
    .from('assistant_links')
    .select('coach_id')
    .eq('assistant_id', userId)
    .maybeSingle()

  if (!link) {
    return {
      effectiveUserId: userId,
      assistantOfCoachName: null as string | null,
      effectiveCategories: ownCategories,
    }
  }

  const { data: coachProfile } = await getProfile(link.coach_id)
  return {
    effectiveUserId: link.coach_id,
    assistantOfCoachName: coachProfile?.full_name ?? null,
    effectiveCategories: coachProfile?.categories ?? [],
  }
}

export function useAuth() {
  const {
    profile, setProfile, setEffectiveUserId, setAssistantOfCoachName, setEffectiveCategories,
  } = useAppStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sesión inicial al cargar
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await getProfile(session.user.id)
        if (data) {
          setProfile(data)
          const { effectiveUserId, assistantOfCoachName, effectiveCategories } =
            await resolveEffectiveUser(session.user.id, data.categories ?? [])
          setEffectiveUserId(effectiveUserId)
          setAssistantOfCoachName(assistantOfCoachName)
          setEffectiveCategories(effectiveCategories)
        }
      }
      setLoading(false)
    })

    // Escuchar cambios
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const { data } = await getProfile(session.user.id)
          if (data) {
            setProfile(data)
            const { effectiveUserId, assistantOfCoachName, effectiveCategories } =
              await resolveEffectiveUser(session.user.id, data.categories ?? [])
            setEffectiveUserId(effectiveUserId)
            setAssistantOfCoachName(assistantOfCoachName)
            setEffectiveCategories(effectiveCategories)
          }
        } else {
          setProfile(null)
          setEffectiveUserId(null)
          setAssistantOfCoachName(null)
          setEffectiveCategories([])
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [setProfile, setEffectiveUserId, setAssistantOfCoachName, setEffectiveCategories])

  return { profile, loading }
}
