import { create } from 'zustand'
import type { Profile, TeamCategory, Account } from '@/types'

interface AppState {
  profile: Profile | null
  setProfile: (p: Profile | null) => void

  // Cuenta (club o entrenador individual) reconocida por el código ingresado en la pantalla
  // de entrada. Define la identidad visual (nombre, logo, color) de toda la app.
  account: Account | null
  setAccount: (a: Account | null) => void

  // ID a usar para leer/escribir datos (training_sessions.user_id, players.user_id, etc.).
  // Para un coach normal es su propio id. Para un Ayudante Técnico vinculado, es el id
  // del coach al que ayuda — así opera sobre los mismos datos sin duplicar lógica en cada pantalla.
  effectiveUserId: string | null
  setEffectiveUserId: (id: string | null) => void

  // Nombre del coach al que se está ayudando, solo informativo para mostrar en la UI
  // (ej: "Estás viendo los datos de Emiliano Molaro"). null si no es un AT o no hay vínculo.
  assistantOfCoachName: string | null
  setAssistantOfCoachName: (name: string | null) => void

  // Categorías de equipo a mostrar en el sidebar. Para un coach normal son las suyas
  // (profile.categories). Para un AT vinculado, son las del coach al que ayuda.
  effectiveCategories: TeamCategory[]
  setEffectiveCategories: (cats: TeamCategory[]) => void

  // Para un Preparador Físico: lista de sus vínculos (categoría + coach al que pertenece esa
  // categoría). Se usa en CategoryPage en vez de profile.categories, ya que el preparador no
  // tiene categorías propias — eligió categorías de otros coaches al registrarse.
  trainerLinkOptions: { category: TeamCategory; coachId: string; coachName: string }[]
  setTrainerLinkOptions: (opts: { category: TeamCategory; coachId: string; coachName: string }[]) => void

  selectedCategory: TeamCategory | null
  setSelectedCategory: (c: TeamCategory | null) => void

  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),

  account: null,
  setAccount: (account) => set({ account }),

  effectiveUserId: null,
  setEffectiveUserId: (effectiveUserId) => set({ effectiveUserId }),

  assistantOfCoachName: null,
  setAssistantOfCoachName: (assistantOfCoachName) => set({ assistantOfCoachName }),

  effectiveCategories: [],
  setEffectiveCategories: (effectiveCategories) => set({ effectiveCategories }),

  trainerLinkOptions: [],
  setTrainerLinkOptions: (trainerLinkOptions) => set({ trainerLinkOptions }),

  selectedCategory: null,
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))
