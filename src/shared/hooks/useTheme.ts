import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
export type Palette = 'sawdust' | 'workshop' | 'graphite'
export type Density = 'comfort' | 'dense'

const PALETTES: Palette[] = ['sawdust', 'workshop', 'graphite']

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme') as Theme | null
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialPalette(): Palette {
  const stored = localStorage.getItem('cp.palette') as Palette | null
  return stored && PALETTES.includes(stored) ? stored : 'sawdust'
}

function getInitialDensity(): Density {
  const stored = localStorage.getItem('cp.density') as Density | null
  return stored === 'dense' ? 'dense' : 'comfort'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [palette, setPalette] = useState<Palette>(getInitialPalette)
  const [density, setDensity] = useState<Density>(getInitialDensity)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    PALETTES.forEach(p => root.classList.remove(`theme-${p}`))
    root.classList.add(`theme-${palette}`)
    localStorage.setItem('cp.palette', palette)
  }, [palette])

  useEffect(() => {
    const root = document.documentElement
    if (density === 'dense') root.classList.add('dense')
    else root.classList.remove('dense')
    localStorage.setItem('cp.density', density)
  }, [density])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return { theme, setTheme, toggle, palette, setPalette, density, setDensity }
}
