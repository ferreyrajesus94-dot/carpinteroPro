import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { FurnitureTemplateWithItems } from '../types'

vi.mock('../api/recipes', () => ({
  fetchFurnitureTemplates: vi.fn(),
  fetchFurnitureTemplate: vi.fn(),
  createFurnitureTemplate: vi.fn(),
  updateFurnitureTemplate: vi.fn(),
  deleteFurnitureTemplate: vi.fn(),
}))

import * as recipesApi from '../api/recipes'

const WORKSHOP_ID = '00000000-0000-0000-0000-000000000001'
const TEMPLATE_ID = 'tmpl-1'

function makeQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

const MOCK_MATERIAL = {
  id: 'mat-1',
  name: 'MDF 18mm',
  category: 'madera' as const,
  unit: 'm2' as const,
  price_per_unit: 2500,
  wood_subtype: null,
  length_cm: null,
  width_cm: null,
  thickness_cm: null,
}

const MOCK_TEMPLATE: FurnitureTemplateWithItems = {
  id: TEMPLATE_ID,
  workshop_id: WORKSHOP_ID,
  name: 'Ropero 2 puertas',
  notes: null,
  category: null,
  tags: [],
  height_cm: null,
  width_cm: null,
  depth_cm: null,
  photo_url: null,
  suggested_margin_pct: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  recipe_items: [
    {
      id: 'ri-1',
      furniture_template_id: TEMPLATE_ID,
      material_id: 'mat-1',
      quantity: 4,
      waste_pct: 0,
      material: MOCK_MATERIAL,
    },
  ],
  labor_items: [],
  recipe_pieces: [],
  params: [],
}

// ── useFurnitureTemplates ──────────────────────────────────────────────────
describe('useFurnitureTemplates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns templates list from the API', async () => {
    vi.mocked(recipesApi.fetchFurnitureTemplates).mockResolvedValue([MOCK_TEMPLATE])

    const { useFurnitureTemplates } = await import('./useRecipes')
    const { result } = renderHook(
      () => useFurnitureTemplates(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([MOCK_TEMPLATE])
    expect(recipesApi.fetchFurnitureTemplates).toHaveBeenCalledWith(WORKSHOP_ID)
  })

  it('does not fetch when workshopId is empty', async () => {
    const { useFurnitureTemplates } = await import('./useRecipes')
    const { result } = renderHook(
      () => useFurnitureTemplates(''),
      { wrapper: makeQueryWrapper() }
    )

    expect(result.current.isPending).toBe(true)
    expect(recipesApi.fetchFurnitureTemplates).not.toHaveBeenCalled()
  })

  it('returns error when API fails', async () => {
    vi.mocked(recipesApi.fetchFurnitureTemplates).mockRejectedValue(new Error('DB error'))

    const { useFurnitureTemplates } = await import('./useRecipes')
    const { result } = renderHook(
      () => useFurnitureTemplates(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useFurnitureTemplate (single) ─────────────────────────────────────────
describe('useFurnitureTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a single template by id', async () => {
    vi.mocked(recipesApi.fetchFurnitureTemplate).mockResolvedValue(MOCK_TEMPLATE)

    const { useFurnitureTemplate } = await import('./useRecipes')
    const { result } = renderHook(
      () => useFurnitureTemplate(TEMPLATE_ID),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(MOCK_TEMPLATE)
    expect(recipesApi.fetchFurnitureTemplate).toHaveBeenCalledWith(TEMPLATE_ID)
  })

  it('does not fetch when id is null', async () => {
    const { useFurnitureTemplate } = await import('./useRecipes')
    const { result } = renderHook(
      () => useFurnitureTemplate(null),
      { wrapper: makeQueryWrapper() }
    )

    expect(result.current.isPending).toBe(true)
    expect(recipesApi.fetchFurnitureTemplate).not.toHaveBeenCalled()
  })
})

// ── useCreateFurnitureTemplate ────────────────────────────────────────────
describe('useCreateFurnitureTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls API with template and items, returns new id', async () => {
    vi.mocked(recipesApi.createFurnitureTemplate).mockResolvedValue(TEMPLATE_ID)

    const { useCreateFurnitureTemplate } = await import('./useRecipes')
    const { result } = renderHook(
      () => useCreateFurnitureTemplate(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    const payload = {
      template: { workshop_id: WORKSHOP_ID, name: 'Ropero 2 puertas', description: null },
      items: [{ material_id: 'mat-1', quantity: 4 }],
    }

    await act(() => result.current.mutateAsync(payload))

    expect(recipesApi.createFurnitureTemplate).toHaveBeenCalledWith(
      payload.template,
      payload.items,
      undefined,
      undefined
    )
  })

  it('sets isError when API fails', async () => {
    vi.mocked(recipesApi.createFurnitureTemplate).mockRejectedValue(new Error('Insert failed'))

    const { useCreateFurnitureTemplate } = await import('./useRecipes')
    const { result } = renderHook(
      () => useCreateFurnitureTemplate(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await act(() =>
      result.current.mutate({
        template: { workshop_id: WORKSHOP_ID, name: 'X', notes: null },
        items: [],
      })
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useUpdateFurnitureTemplate ────────────────────────────────────────────
describe('useUpdateFurnitureTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls API with id, updated template and new items', async () => {
    vi.mocked(recipesApi.updateFurnitureTemplate).mockResolvedValue(undefined)

    const { useUpdateFurnitureTemplate } = await import('./useRecipes')
    const { result } = renderHook(
      () => useUpdateFurnitureTemplate(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    const payload = {
      id: TEMPLATE_ID,
      template: { name: 'Ropero 3 puertas' },
      items: [{ material_id: 'mat-1', quantity: 6 }],
    }

    await act(() => result.current.mutateAsync(payload))

    expect(recipesApi.updateFurnitureTemplate).toHaveBeenCalledWith(
      TEMPLATE_ID,
      payload.template,
      payload.items,
      undefined,
      undefined
    )
  })
})

// ── useDeleteFurnitureTemplate ────────────────────────────────────────────
describe('useDeleteFurnitureTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls API with the template id', async () => {
    vi.mocked(recipesApi.deleteFurnitureTemplate).mockResolvedValue(undefined)

    const { useDeleteFurnitureTemplate } = await import('./useRecipes')
    const { result } = renderHook(
      () => useDeleteFurnitureTemplate(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await act(() => result.current.mutateAsync(TEMPLATE_ID))

    expect(recipesApi.deleteFurnitureTemplate).toHaveBeenCalledWith(TEMPLATE_ID)
  })
})
