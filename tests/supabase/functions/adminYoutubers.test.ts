import { describe, it, expect } from 'vitest'
import { mapYoutuberSummary, mapYoutuberList } from '../../../supabase/functions/admin-youtubers/mapping'
import { ACTIVE_SUBSCRIPTION_STATUSES, loadYoutuberAggregates } from '../../../supabase/functions/admin-youtubers/aggregates'

interface QueryCall {
  table: string
  method: 'select' | 'in'
  column?: string
  values?: readonly string[]
  columns?: string
}

function createAggregateClient() {
  const calls: QueryCall[] = []
  const client = {
    calls,
    from(table: string) {
      return {
        data: [],
        select(columns: string) {
          calls.push({ table, method: 'select', columns })
          return this
        },
        in(column: string, values: readonly string[]) {
          calls.push({ table, method: 'in', column, values })
          return this
        },
      }
    },
  }
  return client
}

describe('admin-youtubers / mapYoutuberSummary', () => {
  it('maps a youtuber row with aggregations to API shape', () => {
    const row = {
      id: 'yt-1',
      display_name: 'Canal Madera',
      channel_url: 'https://youtube.com/@canalmadera',
      contact_email: 'madera@example.com',
      payout_method: 'mp',
      is_active: true,
      created_at: '2026-01-15T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
    }

    const result = mapYoutuberSummary(row, 3, 5, 12475.50)

    expect(result).toEqual({
      id: 'yt-1',
      displayName: 'Canal Madera',
      channelUrl: 'https://youtube.com/@canalmadera',
      contactEmail: 'madera@example.com',
      payoutMethod: 'mp',
      isActive: true,
      codeCount: 3,
      activeReferredWorkshops: 5,
      lifetimeCommission: 12475.50,
    })
  })

  it('handles null optional fields', () => {
    const row = {
      id: 'yt-2',
      display_name: 'Solo Nombre',
      channel_url: null,
      contact_email: null,
      payout_method: null,
      is_active: false,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
    }

    const result = mapYoutuberSummary(row, 0, 0, 0)

    expect(result.channelUrl).toBeNull()
    expect(result.contactEmail).toBeNull()
    expect(result.payoutMethod).toBeNull()
    expect(result.isActive).toBe(false)
    expect(result.codeCount).toBe(0)
    expect(result.activeReferredWorkshops).toBe(0)
    expect(result.lifetimeCommission).toBe(0)
  })

  it('formats commission as a number', () => {
    const row = {
      id: 'yt-3',
      display_name: 'Test',
      channel_url: null,
      contact_email: null,
      payout_method: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }

    const result = mapYoutuberSummary(row, 1, 2, 499.99)
    expect(result.lifetimeCommission).toBe(499.99)
  })
})

describe('admin-youtubers / mapYoutuberList', () => {
  it('maps an array of youtuber rows to API response', () => {
    const rows = [
      {
        id: 'yt-1',
        display_name: 'Canal Madera',
        channel_url: 'https://youtube.com/@canalmadera',
        contact_email: 'madera@example.com',
        payout_method: 'mp',
        is_active: true,
        created_at: '2026-01-15T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
      {
        id: 'yt-2',
        display_name: 'Otro Canal',
        channel_url: null,
        contact_email: null,
        payout_method: null,
        is_active: false,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
    ]

    const result = mapYoutuberList(rows, { 'yt-1': { codeCount: 3, activeWorkshops: 5, lifetimeCommission: 12475.50 }, 'yt-2': { codeCount: 0, activeWorkshops: 0, lifetimeCommission: 0 } })

    expect(result).toEqual({
      youtubers: [
        expect.objectContaining({ id: 'yt-1', displayName: 'Canal Madera', codeCount: 3 }),
        expect.objectContaining({ id: 'yt-2', displayName: 'Otro Canal', codeCount: 0 }),
      ],
    })
  })

  it('returns empty list when no rows', () => {
    const result = mapYoutuberList([], {})
    expect(result).toEqual({ youtubers: [] })
  })
})

describe('admin-youtubers / loadYoutuberAggregates', () => {
  it('filters active referred workshops by active subscription statuses', async () => {
    const client = createAggregateClient()

    await loadYoutuberAggregates(client, ['yt-1'])

    expect(client.calls).toContainEqual({
      table: 'workshop_referrals',
      method: 'select',
      columns: 'youtuber_id, count: workshop_id, subscriptions!inner(status)',
    })
    expect(client.calls).toContainEqual({
      table: 'workshop_referrals',
      method: 'in',
      column: 'subscriptions.status',
      values: ACTIVE_SUBSCRIPTION_STATUSES,
    })
  })
})
