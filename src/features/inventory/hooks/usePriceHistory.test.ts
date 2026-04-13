import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { PriceHistory } from '../types'

vi.mock('../api/materials', () => ({
  fetchPriceHistory: vi.fn(),
}))

import * as materialsApi from '../api/materials'

function makeQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

const MOCK_HISTORY: PriceHistory[] = [
  {
    id: 'ph-1',
    material_id: 'mat-1',
    workshop_id: '00000000-0000-0000-0000-000000000001',
    old_price: 2000,
    new_price: 2500,
    changed_at: '2026-02-01T00:00:00Z',
  },
  {
    id: 'ph-2',
    material_id: 'mat-1',
    workshop_id: '00000000-0000-0000-0000-000000000001',
    old_price: 2500,
    new_price: 3000,
    changed_at: '2026-03-01T00:00:00Z',
  },
]

describe('usePriceHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches price history for a given materialId', async () => {
    vi.mocked(materialsApi.fetchPriceHistory).mockResolvedValue(MOCK_HISTORY)

    const { usePriceHistory } = await import('./usePriceHistory')
    const { result } = renderHook(
      () => usePriceHistory('mat-1'),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(MOCK_HISTORY)
    expect(materialsApi.fetchPriceHistory).toHaveBeenCalledWith('mat-1')
  })

  it('does not fetch when materialId is null', async () => {
    vi.mocked(materialsApi.fetchPriceHistory).mockResolvedValue([])

    const { usePriceHistory } = await import('./usePriceHistory')
    const { result } = renderHook(
      () => usePriceHistory(null),
      { wrapper: makeQueryWrapper() }
    )

    // Should stay in pending/loading, not call API
    await new Promise((r) => setTimeout(r, 100))

    expect(result.current.isFetching).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(materialsApi.fetchPriceHistory).not.toHaveBeenCalled()
  })

  it('returns price history in chronological order', async () => {
    vi.mocked(materialsApi.fetchPriceHistory).mockResolvedValue(MOCK_HISTORY)

    const { usePriceHistory } = await import('./usePriceHistory')
    const { result } = renderHook(
      () => usePriceHistory('mat-1'),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const dates = result.current.data!.map((h) => h.changed_at)
    expect(dates[0] < dates[1]).toBe(true)
  })
})
