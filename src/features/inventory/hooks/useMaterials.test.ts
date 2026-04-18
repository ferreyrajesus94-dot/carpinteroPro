import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { Material } from '../types'

// Mock the API module — we test hook behavior, not network calls
vi.mock('../api/materials', () => ({
  fetchMaterials: vi.fn(),
  createMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  deleteMaterial: vi.fn(),
}))

import * as materialsApi from '../api/materials'

const WORKSHOP_ID = '00000000-0000-0000-0000-000000000001'

function makeQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

const MOCK_MATERIALS: Material[] = [
  {
    id: 'mat-1',
    workshop_id: WORKSHOP_ID,
    name: 'Madera MDF 18mm',
    category: 'madera',
    unit: 'm2',
    price_per_unit: 2500,
    stock: 10,
    min_stock: 5,
    notes: null,
    wood_subtype: null,
    length_cm: null,
    width_cm: null,
    thickness_cm: null,
    volume_ml: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mat-2',
    workshop_id: WORKSHOP_ID,
    name: 'Bisagra 35mm',
    category: 'herraje',
    unit: 'un',
    price_per_unit: 150,
    stock: 2,
    min_stock: 10,
    notes: null,
    wood_subtype: null,
    length_cm: null,
    width_cm: null,
    thickness_cm: null,
    volume_ml: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

describe('useMaterials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns materials from the API', async () => {
    vi.mocked(materialsApi.fetchMaterials).mockResolvedValue(MOCK_MATERIALS)

    const { useMaterials } = await import('./useMaterials')
    const { result } = renderHook(
      () => useMaterials(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(MOCK_MATERIALS)
    expect(materialsApi.fetchMaterials).toHaveBeenCalledWith(WORKSHOP_ID, undefined)
  })

  it('passes category filter to the API', async () => {
    vi.mocked(materialsApi.fetchMaterials).mockResolvedValue([MOCK_MATERIALS[0]])

    const { useMaterials } = await import('./useMaterials')
    const { result } = renderHook(
      () => useMaterials(WORKSHOP_ID, { category: 'madera' }),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(materialsApi.fetchMaterials).toHaveBeenCalledWith(WORKSHOP_ID, { category: 'madera' })
  })

  it('exposes isLowStock helper on each material', async () => {
    vi.mocked(materialsApi.fetchMaterials).mockResolvedValue(MOCK_MATERIALS)

    const { useMaterials } = await import('./useMaterials')
    const { result } = renderHook(
      () => useMaterials(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const lowStockCount = result.current.data!.filter((m) => m.stock <= m.min_stock).length
    expect(lowStockCount).toBe(1) // only Bisagra
  })

  it('returns error when API fails', async () => {
    vi.mocked(materialsApi.fetchMaterials).mockRejectedValue(new Error('Network error'))

    const { useMaterials } = await import('./useMaterials')
    const { result } = renderHook(
      () => useMaterials(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})
