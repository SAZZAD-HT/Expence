/**
 * UI preferences. Non-sensitive — safe to persist in localStorage.
 * `night` = default dark neon theme. `paper` = solid white, centered column.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UiMode = 'night' | 'paper'

interface UiState {
  mode: UiMode
  setMode: (mode: UiMode) => void
  toggleMode: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      mode: 'night',
      setMode: (mode) => set({ mode }),
      toggleMode: () => set({ mode: get().mode === 'night' ? 'paper' : 'night' }),
    }),
    { name: 'ui-mode' }
  )
)
