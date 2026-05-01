import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { QuoteWithExtras } from '../types'

vi.mock('../api/stockDiscount', () => ({
  maybeAutoDiscountStock: vi.fn().mockResolvedValue({ ok: 0, errors: [] }),
}))

vi.mock('../api/quotes', () => ({
  fetchQuotes: vi.fn(),
  fetchQuote: vi.fn(),
  createQuote: vi.fn(),
  updateQuote: vi.fn(),
  deleteQuote: vi.fn(),
  generateQuoteNumber: vi.fn(),
}))

import * as quotesApi from '../api/quotes'

const WORKSHOP_ID = '00000000-0000-0000-0000-000000000001'

function makeQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

const MOCK_QUOTES: QuoteWithExtras[] = [
  {
    id: 'q-1',
    workshop_id: WORKSHOP_ID,
    quote_number: 'P-0001',
    client_id: null,
    furniture_template_id: null,
    furniture_name: 'Ropero 2 puertas',
    recipe_cost: 10000,
    status: 'presupuesto',
    margin_mode: 'on_cost',
    margin_pct: 30,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    extras: [],
    client: null,
  },
  {
    id: 'q-2',
    workshop_id: WORKSHOP_ID,
    quote_number: 'P-0002',
    client_id: 'cli-1',
    furniture_template_id: null,
    furniture_name: 'Mesa comedor',
    recipe_cost: 25000,
    status: 'aprobado',
    margin_mode: 'on_price',
    margin_pct: 40,
    notes: 'Patas de roble',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    extras: [
      { id: 'ex-1', workshop_id: '00000000-0000-0000-0000-000000000001', quote_id: 'q-2', description: 'Barniz', amount: 2000, show_in_quote: true, sort_order: 0 },
    ],
    client: null,
  },
]

describe('useQuotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns quotes from the API', async () => {
    vi.mocked(quotesApi.fetchQuotes).mockResolvedValue(MOCK_QUOTES)

    const { useQuotes } = await import('./useQuotes')
    const { result } = renderHook(
      () => useQuotes(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(MOCK_QUOTES)
    expect(quotesApi.fetchQuotes).toHaveBeenCalledWith(WORKSHOP_ID)
  })

  it('returns empty array when API returns nothing', async () => {
    vi.mocked(quotesApi.fetchQuotes).mockResolvedValue([])

    const { useQuotes } = await import('./useQuotes')
    const { result } = renderHook(
      () => useQuotes(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('returns error when API fails', async () => {
    vi.mocked(quotesApi.fetchQuotes).mockRejectedValue(new Error('Network error'))

    const { useQuotes } = await import('./useQuotes')
    const { result } = renderHook(
      () => useQuotes(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('does not fetch when workshopId is empty', async () => {
    const { useQuotes } = await import('./useQuotes')
    const { result } = renderHook(
      () => useQuotes(''),
      { wrapper: makeQueryWrapper() }
    )

    // query is disabled, stays pending
    expect(result.current.isPending).toBe(true)
    expect(quotesApi.fetchQuotes).not.toHaveBeenCalled()
  })
})

describe('useGenerateQuoteNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the next quote number from the API', async () => {
    vi.mocked(quotesApi.generateQuoteNumber).mockResolvedValue('P-0003')

    const { useGenerateQuoteNumber } = await import('./useQuotes')
    const { result } = renderHook(
      () => useGenerateQuoteNumber(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('P-0003')
  })
})

// ── useCreateQuote ────────────────────────────────────────────────────────
describe('useCreateQuote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls createQuote with quote and extras', async () => {
    vi.mocked(quotesApi.createQuote).mockResolvedValue('q-new')

    const { useCreateQuote } = await import('./useQuotes')
    const { result } = renderHook(
      () => useCreateQuote(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    const payload = {
      quote: {
        workshop_id: WORKSHOP_ID,
        quote_number: 'P-0003',
        furniture_name: 'Mesa comedor',
        recipe_cost: 15_000,
        margin_mode: 'on_cost' as const,
        margin_pct: 30,
        status: 'presupuesto' as const,
        client_id: null,
        furniture_template_id: null,
        notes: null,
      },
      extras: [{ description: 'Barniz', amount: 500, show_in_quote: true, sort_order: 0 }],
    }

    await act(() => result.current.mutateAsync(payload))

    expect(quotesApi.createQuote).toHaveBeenCalledWith(payload.quote, payload.extras, [], [])
  })

  it('sets isError when API fails', async () => {
    vi.mocked(quotesApi.createQuote).mockRejectedValue(new Error('Insert failed'))

    const { useCreateQuote } = await import('./useQuotes')
    const { result } = renderHook(
      () => useCreateQuote(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await act(() =>
      result.current.mutate({
        quote: {
          workshop_id: WORKSHOP_ID,
          quote_number: 'P-0003',
          furniture_name: 'X',
          recipe_cost: 0,
          margin_mode: 'on_cost',
          margin_pct: 0,
          status: 'presupuesto',
          client_id: null,
          furniture_template_id: null,
          notes: null,
        },
        extras: [],
      })
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useUpdateQuote — cambio de estado a "enviado" ─────────────────────────
describe('useUpdateQuote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('can update a quote status to "enviado"', async () => {
    vi.mocked(quotesApi.updateQuote).mockResolvedValue(undefined)

    const { useUpdateQuote } = await import('./useQuotes')
    const { result } = renderHook(
      () => useUpdateQuote(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await act(() =>
      result.current.mutateAsync({
        id: 'q-1',
        quote: { status: 'enviado' },
        extras: [],
      })
    )

    expect(quotesApi.updateQuote).toHaveBeenCalledWith(
      'q-1',
      { status: 'enviado' },
      [],
      [],
      []
    )
  })

  it('can update quote with new extras', async () => {
    vi.mocked(quotesApi.updateQuote).mockResolvedValue(undefined)

    const { useUpdateQuote } = await import('./useQuotes')
    const { result } = renderHook(
      () => useUpdateQuote(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    const newExtras = [{ description: 'Transporte', amount: 1_000, show_in_quote: true, sort_order: 0 }]

    await act(() =>
      result.current.mutateAsync({ id: 'q-1', quote: { margin_pct: 35 }, extras: newExtras })
    )

    expect(quotesApi.updateQuote).toHaveBeenCalledWith('q-1', { margin_pct: 35 }, newExtras, [], [])
  })

  it('sets isError when API fails', async () => {
    vi.mocked(quotesApi.updateQuote).mockRejectedValue(new Error('Update failed'))

    const { useUpdateQuote } = await import('./useQuotes')
    const { result } = renderHook(
      () => useUpdateQuote(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await act(() =>
      result.current.mutate({ id: 'q-1', quote: { status: 'enviado' }, extras: [] })
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useDeleteQuote ────────────────────────────────────────────────────────
describe('useDeleteQuote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls deleteQuote with the quote id', async () => {
    vi.mocked(quotesApi.deleteQuote).mockResolvedValue(undefined)

    const { useDeleteQuote } = await import('./useQuotes')
    const { result } = renderHook(
      () => useDeleteQuote(WORKSHOP_ID),
      { wrapper: makeQueryWrapper() }
    )

    await act(() => result.current.mutateAsync('q-1'))

    expect(quotesApi.deleteQuote).toHaveBeenCalledWith('q-1')
  })
})
