'use client'

import { useEffect } from 'react'
import { useUiStore } from '@/store/ui.store'

export default function ModeProvider() {
  const mode = useUiStore((s) => s.mode)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('mode-paper', mode === 'paper')
    root.classList.toggle('mode-night', mode === 'night')
  }, [mode])

  return null
}
