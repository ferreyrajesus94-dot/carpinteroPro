import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@/shared/providers/AuthProvider', () => ({
  useAuth: vi.fn(),
}))

import * as authProvider from '@/shared/providers/AuthProvider'
import { useWorkshopId } from './useWorkshopId'

const mockUseAuth = vi.mocked(authProvider.useAuth)

function makeAuthValue(workshopId: string | null) {
  return {
    session: null,
    workshopId,
    onboardedAt: null,
    loading: false,
    status: 'ready' as const,
    profileIssue: null,
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  }
}

describe('useWorkshopId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the workshopId from auth context', () => {
    mockUseAuth.mockReturnValue(makeAuthValue('00000000-0000-0000-0000-000000000001'))

    const { result } = renderHook(() => useWorkshopId())

    expect(result.current).toBe('00000000-0000-0000-0000-000000000001')
  })

  it('returns empty string when workshopId is null', () => {
    mockUseAuth.mockReturnValue(makeAuthValue(null))

    const { result } = renderHook(() => useWorkshopId())

    expect(result.current).toBe('')
  })
})
