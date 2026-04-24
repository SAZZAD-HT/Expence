'use client'

import { Moon, Sun } from 'lucide-react'
import { useUiStore } from '@/store/ui.store'

export default function ModeToggle() {
  const mode = useUiStore((s) => s.mode)
  const toggleMode = useUiStore((s) => s.toggleMode)
  const isPaper = mode === 'paper'

  return (
    <button
      onClick={toggleMode}
      aria-label={isPaper ? 'Switch to night mode' : 'Switch to paper mode'}
      title={isPaper ? 'Switch to night mode' : 'Switch to paper mode'}
      className="mode-toggle flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[0.78rem] uppercase tracking-[0.14em] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-neon-cyan)] hover:bg-white/[.03] transition-colors"
    >
      {isPaper ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      <span className="font-[family-name:var(--font-mono)]">
        {isPaper ? 'Night Mode' : 'Paper Mode'}
      </span>
    </button>
  )
}
