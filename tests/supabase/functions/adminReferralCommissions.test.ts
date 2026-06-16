import { describe, it, expect } from 'vitest'
import {
  buildCommissionCsv,
  type CommissionFilters,
  type CommissionRow,
  validateCommissionsRequest,
} from '../../../supabase/functions/admin-referral-commissions/mapping'

describe('admin-referral-commissions / validateCommissionsRequest', () => {
  it('accepts empty request (all commissions)', () => {
    const result = validateCommissionsRequest({})
    expect(result).toEqual({ ok: true, data: {} })
  })

  it('accepts youtuberId filter', () => {
    const result = validateCommissionsRequest({ youtuberId: 'yt-1' })
    expect(result).toEqual({ ok: true, data: { youtuberId: 'yt-1' } })
  })

  it('accepts fromDate and toDate', () => {
    const result = validateCommissionsRequest({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    })
    expect(result).toEqual({ ok: true, data: { fromDate: '2026-01-01', toDate: '2026-01-31' } })
  })

  it('accepts limit', () => {
    const result = validateCommissionsRequest({ limit: 50 })
    expect(result).toEqual({ ok: true, data: { limit: 50 } })
  })

  it('accepts format csv', () => {
    const result = validateCommissionsRequest({ format: 'csv' })
    expect(result).toEqual({ ok: true, data: { format: 'csv' } })
  })

  it('rejects invalid format', () => {
    const result = validateCommissionsRequest({ format: 'xml' })
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'format must be json or csv' },
    })
  })

  it('rejects out-of-range limit', () => {
    const result = validateCommissionsRequest({ limit: 2000 })
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'limit must be between 1 and 1000' },
    })
  })

  it('rejects negative limit', () => {
    const result = validateCommissionsRequest({ limit: -1 })
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'limit must be between 1 and 1000' },
    })
  })
})

describe('admin-referral-commissions / buildCommissionCsv', () => {
  const rows: CommissionRow[] = [
    {
      id: 'c1',
      workshopId: 'ws-1',
      youtuberId: 'yt-1',
      referralCodeId: 'rc-1',
      subscriptionId: 'sub-1',
      providerPaymentId: 'mp_pay_1',
      paymentAmount: 4990,
      commissionPct: 15,
      commissionAmount: 748.50,
      currency: 'ARS',
      occurredAt: '2026-01-15T10:00:00Z',
      youtuberName: 'Canal Madera',
      code: 'PROMO20',
      workshopName: 'Taller del Este',
    },
    {
      id: 'c2',
      workshopId: 'ws-2',
      youtuberId: 'yt-1',
      referralCodeId: 'rc-1',
      subscriptionId: 'sub-2',
      providerPaymentId: 'mp_pay_2',
      paymentAmount: 3992,
      commissionPct: 15,
      commissionAmount: 598.80,
      currency: 'ARS',
      occurredAt: '2026-02-15T10:00:00Z',
      youtuberName: 'Canal Madera',
      code: 'PROMO20',
      workshopName: 'Taller del Oeste',
    },
  ]

  it('produces header row and data rows', () => {
    const csv = buildCommissionCsv(rows)
    const lines = csv.split('\n')
    expect(lines.length).toBe(3) // header + 2 data rows + trailing empty from join

    expect(lines[0]).toContain('occurred_at')
    expect(lines[0]).toContain('youtuber')
    expect(lines[0]).toContain('code')
    expect(lines[0]).toContain('workshop')
    expect(lines[0]).toContain('payment_amount')
    expect(lines[0]).toContain('commission_amount')
    expect(lines[0]).toContain('currency')
  })

  it('includes correct data values', () => {
    const csv = buildCommissionCsv(rows)
    expect(csv).toContain('Canal Madera')
    expect(csv).toContain('PROMO20')
    expect(csv).toContain('Taller del Este')
    expect(csv).toContain('4990')
    expect(csv).toContain('748.5')
    expect(csv).toContain('3992')
    expect(csv).toContain('598.8')
  })

  it('escapes commas and quotes in values', () => {
    const rowsWithSpecial: CommissionRow[] = [
      {
        id: 'c3',
        workshopId: 'ws-3',
        youtuberId: 'yt-2',
        referralCodeId: 'rc-2',
        subscriptionId: null,
        providerPaymentId: 'mp_pay_3',
        paymentAmount: 4990,
        commissionPct: 10,
        commissionAmount: 499,
        currency: 'ARS',
        occurredAt: '2026-03-01T00:00:00Z',
        youtuberName: 'Canal, "La Madera"',
        code: 'MADERA10',
        workshopName: 'Taller & Co.',
      },
    ]
    const csv = buildCommissionCsv(rowsWithSpecial)
    // Quotes should be escaped inside the field
    expect(csv).toContain('"Canal, ""La Madera"""')
  })

  it('handles empty rows list', () => {
    const csv = buildCommissionCsv([])
    const lines = csv.split('\n').filter((l) => l.length > 0)
    expect(lines.length).toBe(1) // just header
    expect(lines[0]).toContain('occurred_at')
  })

  it('handles rows with null youtuberName and workshopName', () => {
    const rowsWithNull: CommissionRow[] = [
      {
        id: 'c4',
        workshopId: 'ws-4',
        youtuberId: 'yt-3',
        referralCodeId: 'rc-3',
        subscriptionId: null,
        providerPaymentId: 'mp_pay_4',
        paymentAmount: 4990,
        commissionPct: 20,
        commissionAmount: 998,
        currency: 'ARS',
        occurredAt: '2026-04-01T00:00:00Z',
        youtuberName: null,
        code: null,
        workshopName: null,
      },
    ]
    const csv = buildCommissionCsv(rowsWithNull)
    expect(csv).not.toContain('undefined')
    // Null fields should produce empty columns in CSV (consecutive commas)
    expect(csv).toContain('T00:00:00Z",,,,"4990"')
  })
})
