import { useEffect, useState } from 'react'
import { supabase, getProfile, getTrainerLinks } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { getAccountById } from '@/lib/accounts'
import type { TeamCategory } from '@/types'

// Resuelve, para el usuario logueado, qué user_id debe usarse para leer/escribir datos:
// - Coach normal (sin AT): su propio id.
// - Ayudante Técnico vinculado a un coach: el id del coach (opera sobre los mismos datos).
// - Preparador Físico: NO se resuelve un único effectiveUserId acá — tiene potencialmente
//   varios vínculos (uno por categoría/coach). Se devuelven sus opciones en trainerLinkOptions,
//   y CategoryPage se encarga de fijar el effectiveUserId según cuál elija el usuario.
async function resolveEffectiveUser(userId: string, role: string, ownCategories: string[]) {
  if (role === 'preparador_fisico') {
    const links = await getTrainerLinks(userId)
    const options = await Promise.all(
      links.map(async (link) => {
        const { data: coachProfile } = await getProfile(link.coach_id)
        return {
          category: link.team_category as TeamCategory,
          coachId: link.coach_id,
          coachName: coachProfile?.full_name ?? '',
        }
      })
    )

    // Restaurar la última categoría/coach elegida, si sigue siendo un vínculo válido —
    // así un refresh de página no deja a la pantalla colgada esperando una selección perdida.
    const savedCoachId = localStorage.getItem('handplan_trainer_active_coach')
    const savedCategory = localStorage.getItem('handplan_trainer_active_category')
    const matchingOption = options.find(o => o.coachId === savedCoachId && o.category === savedCategory)

    return {
      effectiveUserId: matchingOption ? matchingOption.coachId : null,
      assistantOfCoachName: null as string | null,
      effectiveCategories: [] as TeamCategory[],
      trainerLinkOptions: options,
      restoredCategory: matchingOption ? matchingOption.category : null,
    }
  }

  const { data: link } = await supabase
    .from('assistant_links')
    .select('coach_id')
    .eq('assistant_id', userId)
    .maybeSingle()

  if (!link) {
    return {
      effectiveUserId: userId,
      assistantOfCoachName: null as string | null,
      effectiveCategories: ownCategories as TeamCategory[],
      trainerLinkOptions: [],
      restoredCategory: null as TeamCategory | null,
    }
  }

  const { data: coachProfile } = await getProfile(link.coach_id)
  return {
    effectiveUserId: link.coach_id,
    assistantOfCoachName: coachProfile?.full_name ?? null,
    effectiveCategories: (coachProfile?.categories ?? []) as TeamCategory[],
    trainerLinkOptions: [],
    restoredCategory: null as TeamCategory | null,
  }
}

export function useAuth() {
  const {
    profile, setProfile, account, setAccount,
    setEffectiveUserId, setAssistantOfCoachName, setEffectiveCategories, setTrainerLinkOptions,
    setSelectedCategory,
  } = useAppStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function applyProfile(userId: string, data: any) {
      setProfile(data)
      const { effectiveUserId, assistantOfCoachName, effectiveCategories, trainerLinkOptions, restoredCategory } =
        await resolveEffectiveUser(userId, data.role, data.categories ?? [])
      setEffectiveUserId(effectiveUserId)
      setAssistantOfCoachName(assistantOfCoachName)
      setEffectiveCategories(effectiveCategories)
      setTrainerLinkOptions(trainerLinkOptions)
      if (restoredCategory) setSelectedCategory(restoredCategory)

      // Si todavía no hay una Cuenta reconocida en el store (ej: el usuario entró
      // directo con sesión guardada, sin pasar por la pantalla de código), la resolvemos
      // a partir del account_id del perfil — así la identidad visual siempre aparece.
      if (!account && data.account_id) {
        const acc = await getAccountById(data.account_id)
        if (acc) setAccount(acc)
      }
    }

    // Sesión inicial al cargar
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await getProfile(session.user.id)
        if (data) await applyProfile(session.user.id, data)
      }
      setLoading(false)
    })

    // Escuchar cambios
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const { data } = await getProfile(session.user.id)
          if (data) await applyProfile(session.user.id, data)
        } else {
          setProfile(null)
          setEffectiveUserId(null)
          setAssistantOfCoachName(null)
          setEffectiveCategories([])
          setTrainerLinkOptions([])
        }
      }
    )
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setProfile, setEffectiveUserId, setAssistantOfCoachName, setEffectiveCategories, setTrainerLinkOptions, setSelectedCategory, setAccount])

  return { profile, loading }
}
