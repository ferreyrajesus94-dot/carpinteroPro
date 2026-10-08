import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DashboardPage } from './DashboardPage'

const mocks = vi.hoisted(() => ({ quotesRefetch: vi.fn(), productionRefetch: vi.fn(), productionError: false }))
vi.mock('@/shared/hooks/useWorkshopId', () => ({ useWorkshopId: () => 'w-1' }))
vi.mock('@/features/inventory/hooks/useMaterials', () => ({ useMaterials: () => ({ data: [], isError: false, refetch: vi.fn() }) }))
vi.mock('@/features/quotes', () => ({ useQuotes: () => ({ data: [{ id: 'active', status: 'aprobado' }, { id: 'delivered', status: 'aprobado' }, { id: 'draft', status: 'presupuesto' }], isLoading: false, isError: false, refetch: mocks.quotesRefetch }) }))
vi.mock('@/features/production', () => ({
 ProductionPipelineWidget: () => null,
 useQuotesWithProductionStatus: () => ({ data: [{ id: 'active', production_status: 'en_produccion' }, { id: 'delivered', production_status: 'entregado' }], isLoading: false, isError: mocks.productionError, refetch: mocks.productionRefetch }),
}))
vi.mock('@/features/dashboard/components/Dashboard', () => ({
 Dashboard: ({ quotes, quotesError, quotesRefetch }: {quotes: {id: string; status: string}[]; quotesError: boolean; quotesRefetch: () => void}) => <><output>{JSON.stringify(quotes)}</output>{quotesError && <button onClick={quotesRefetch}>Retry</button>}</>,
}))

describe('dashboard production projection', () => {
 it('uses active and delivered order statuses while retaining unprojected drafts', () => {
  render(<DashboardPage />)
  expect(JSON.parse(screen.getByRole('status').textContent ?? '[]')).toEqual([
   {id: 'active', status: 'en_produccion'}, {id: 'delivered', status: 'entregado'}, {id: 'draft', status: 'presupuesto'},
  ])
 })
 it('retries both reads when the projection fails', () => {
  mocks.productionError = true
  render(<DashboardPage />)
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
  expect(mocks.quotesRefetch).toHaveBeenCalledOnce()
  expect(mocks.productionRefetch).toHaveBeenCalledOnce()
  mocks.productionError = false
 })
})
