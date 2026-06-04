import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Dashboard } from './Dashboard'
import type { DashboardMaterial, DashboardQuote } from '../types'

function makeQuote(overrides: Partial<DashboardQuote> = {}): DashboardQuote {
  return {
    id: 'q1',
    quote_number: 'P-001',
    furniture_name: 'Mesa ratona',
    recipe_cost: 1000,
    margin_mode: 'on_cost',
    margin_pct: 0,
    status: 'aprobado',
    created_at: new Date().toISOString(),
    extras: [],
    client: { name: 'Cliente Demo' },
    ...overrides,
  }
}

function makeMaterial(overrides: Partial<DashboardMaterial> = {}): DashboardMaterial {
  return {
    id: 'm1',
    name: 'Melamina blanca',
    stock: 1,
    min_stock: 2,
    ...overrides,
  }
}

describe('Dashboard prop contracts', () => {
  it('renders KPI and attention data from injected quotes and materials', () => {
    render(
      <MemoryRouter>
        <Dashboard
          quotes={[makeQuote()]}
          materials={[makeMaterial()]}
          isLoading={false}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText(/Facturado — Mes actual/)).toBeInTheDocument()
    expect(screen.getAllByText('$ 1.000').length).toBeGreaterThan(0)
    expect(screen.getByText('1 material en stock bajo')).toBeInTheDocument()
    expect(screen.getByText('Melamina blanca')).toBeInTheDocument()
  })

  it('renders the loading skeleton from the injected loading state', () => {
    const { container } = render(
      <MemoryRouter>
        <Dashboard quotes={[]} materials={[]} isLoading />
      </MemoryRouter>,
    )

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })
})
