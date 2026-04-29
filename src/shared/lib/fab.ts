import { useEffect } from 'react'

export type FabAction = 'inventory:new' | 'recipes:new' | 'crm:new' | 'tasks:new'

const EVENT = 'cp:fab'

export function dispatchFab(action: FabAction) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: action }))
}

export function useFabAction(action: FabAction, handler: () => void) {
  useEffect(() => {
    const onFab = (e: Event) => {
      const detail = (e as CustomEvent<FabAction>).detail
      if (detail === action) handler()
    }
    window.addEventListener(EVENT, onFab)
    return () => window.removeEventListener(EVENT, onFab)
  }, [action, handler])
}
