import { useState } from 'react'
import { Info, ChevronRight, ChevronDown } from 'lucide-react'

interface Props {
  storageKey: string
  steps: string[]
}

export function SectionHowto({ storageKey, steps }: Props) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(`cp.howto.${storageKey}`) === 'open' } catch { return false }
  })

  function toggle() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem(`cp.howto.${storageKey}`, next ? 'open' : 'closed') } catch { /* noop */ }
  }

  return (
    <div className="mb-3">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 text-left text-[12px] text-ink2 bg-cp-bg2 border border-line rounded-lg px-3 py-2 hover:border-line2 transition-colors"
      >
        <Info size={14} className="text-cp-accent shrink-0" />
        <span className="flex-1 truncate">
          {open ? 'Cerrar guía de esta sección' : '¿Cómo funciona esta sección?'}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="mt-1.5 rounded-lg border border-line bg-cp-bg2 p-3">
          <p className="text-[11px] uppercase tracking-widest text-ink3 font-medium mb-2">Cómo funciona</p>
          <ul className="space-y-1.5 text-[13px] text-ink2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-cp-accent shrink-0">0{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
