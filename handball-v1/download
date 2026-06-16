import { create } from 'zustand'
import type { Profile, TeamCategory } from '@/types'

interface AppState {
  profile: Profile | null
  setProfile: (p: Profile | null) => void

  selectedCategory: TeamCategory | null
  setSelectedCategory: (c: TeamCategory | null) => void

  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),

  selectedCategory: null,
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))
