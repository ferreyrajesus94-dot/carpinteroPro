import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

// ── Mock supabase before any imports that depend on it ──────────────────────
vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
  setWorkshopId: vi.fn(),
  clearWorkshopId: vi.fn(),
}))

import * as supabaseLib from '@/shared/lib/supabase'
import { AuthProvider, useAuth } from './AuthProvider'

// Typed aliases for convenience
const mockAuth = supabaseLib.supabase.auth as unknown as {
  getSession: ReturnType<typeof vi.fn>
  onAuthStateChange: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
}
const mockFrom = supabaseLib.supabase.from as unknown as ReturnType<typeof vi.fn>

const WORKSHOP_ID = '00000000-0000-0000-0000-000000000001'
const USER_ID = 'user-abc-123'

/** Build the chainable `.from('profiles').select(...).eq(...).single()` mock. */
function mockProfileQuery(workshopId: string | null) {
  const single = vi.fn().mockResolvedValue({
    data: workshopId ? { workshop_id: workshopId } : null,
  })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mockFrom.mockReturnValue({ select })
}

/** Returns a subscription stub; also exposes the last registered callback. */
function makeSubscription() {
  const unsubscribe = vi.fn()
  let cb: (event: string, session: unknown) => void = () => {}
  mockAuth.onAuthStateChange.mockImplementation((handler: typeof cb) => {
    cb = handler
    return { data: { subscription: { unsubscribe } } }
  })
  return {
    unsubscribe,
    fire: (event: string, session: unknown) => act(() => { cb(event, session) }),
  }
}

function makeWrapper() {
  return ({ children }: { children: ReactNode }) =>
    createElement(AuthProvider, null, children)
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default subscription stub (overridden per-test when needed)
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('starts with loading=true, then resolves to false when no session', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } })

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    expect(result.current.workshopId).toBeNull()
  })

  it('loads workshopId from profile when a session is restored', async () => {
    const session = { user: { id: USER_ID } }
    mockAuth.getSession.mockResolvedValue({ data: { session } })
    mockProfileQuery(WORKSHOP_ID)

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.session).toBe(session)
    expect(result.current.workshopId).toBe(WORKSHOP_ID)
    expect(vi.mocked(supabaseLib.setWorkshopId)).toHaveBeenCalledWith(WORKSHOP_ID)
  })

  it('does not set workshopId when profile has no workshop_id', async () => {
    const session = { user: { id: USER_ID } }
    mockAuth.getSession.mockResolvedValue({ data: { session } })
    mockProfileQuery(null)

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.workshopId).toBeNull()
    expect(vi.mocked(supabaseLib.setWorkshopId)).not.toHaveBeenCalled()
  })

  it('updates session and workshopId when onAuthStateChange fires a login', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } })
    const sub = makeSubscription()
    mockProfileQuery(WORKSHOP_ID)

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const newSession = { user: { id: USER_ID } }
    await sub.fire('SIGNED_IN', newSession)

    await waitFor(() => expect(result.current.workshopId).toBe(WORKSHOP_ID))
    expect(result.current.session).toBe(newSession)
  })

  it('clears session and workshopId on logout via onAuthStateChange', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } })
    const sub = makeSubscription()

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await sub.fire('SIGNED_OUT', null)

    expect(vi.mocked(supabaseLib.clearWorkshopId)).toHaveBeenCalled()
    expect(result.current.session).toBeNull()
    expect(result.current.workshopId).toBeNull()
  })

  it('signOut calls supabase.auth.signOut', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } })
    mockAuth.signOut.mockResolvedValue({})

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.signOut())

    expect(mockAuth.signOut).toHaveBeenCalledOnce()
  })

  it('unsubscribes from auth changes on unmount', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } })
    const { unsubscribe } = makeSubscription()

    const { unmount } = renderHook(() => useAuth(), { wrapper: makeWrapper() })
    await waitFor(() => {}) // let useEffect settle

    unmount()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('useAuth throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used inside <AuthProvider>'
    )
  })
})
