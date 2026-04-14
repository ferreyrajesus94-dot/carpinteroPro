import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { Client } from '@/features/crm/types'

vi.mock('@/features/crm/api/clients', () => ({
  fetchClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}))

import * as clientsApi from '@/features/crm/api/clients'

const WORKSHOP_ID = '00000000-0000-0000-0000-000000000001'

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

const MOCK_CLIENTS: Client[] = [
  {
    id: 'cli-1',
    workshop_id: WORKSHOP_ID,
    name: 'Juan Pérez',
    phone: '+54 11 1234-5678',
    email: 'juan@ejemplo.com',
    source: 'instagram',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

describe('useClients', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns clients from the API', async () => {
    vi.mocked(clientsApi.fetchClients).mockResolvedValue(MOCK_CLIENTS)

    const { useClients } = await import('./useClients')
    const { result } = renderHook(() => useClients(WORKSHOP_ID), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(MOCK_CLIENTS)
    expect(clientsApi.fetchClients).toHaveBeenCalledWith(WORKSHOP_ID)
  })

  it('returns error when API fails', async () => {
    vi.mocked(clientsApi.fetchClients).mockRejectedValue(new Error('Network error'))

    const { useClients } = await import('./useClients')
    const { result } = renderHook(() => useClients(WORKSHOP_ID), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})
