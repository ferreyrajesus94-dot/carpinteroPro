import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from './useOnlineStatus'

describe('useOnlineStatus', () => {
  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('updates to false when offline event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { result } = renderHook(() => useOnlineStatus())
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
  })

  it('updates to true when online event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    const { result } = renderHook(() => useOnlineStatus())
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
})
