import { describe, it, expect } from 'vitest'
import {
  computeCommissionAmount,
  buildCommissionRecord,
  recordCommissionIfReferred,
} from '../../../supabase/functions/mercadopago-webhook/commissions'
import type { ReferralCommissionInput } from '../../../supabase/functions/mercadopago-webhook/commissions'

type SupabaseQuery = Parameters<typeof recordCommissionIfReferred>[0]
type QueryError = { message: string; code?: string }
type QueryRow = Record<string, unknown>

interface FakeSupabaseOptions {
  workshopRef: QueryRow | null
  lookupError?: QueryError
  insertError?: QueryError
}

function createFakeSupabase(options: FakeSupabaseOptions): SupabaseQuery {
  const fake = {
    inserted: null as QueryRow | null,
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: table === 'workshop_referrals' ? options.workshopRef : null,
              error: options.lookupError ?? null,
            }),
          }),
        }),
        insert: async (values: QueryRow) => {
          fake.inserted = values
          return { error: options.insertError ?? null }
        },
      }
    },
  }

  return fake
}

const recordingParams = {
  workshopId: 'w1',
  subscriptionId: 'sub1',
  providerPaymentId: 'mp_pay_123',
  paymentAmount: 4990,
  occurredAt: '2026-06-15T12:00:00Z',
}

describe('computeCommissionAmount', () => {
  it('calculates 15% of 4990 = 748.50', () => {
    // round(4990 * 15 / 100, 2) = round(748.50, 2) = 748.50
    expect(computeCommissionAmount(4990, 15)).toBe(748.50)
  })

  it('calculates commission on discounted first payment (3992, 15% = 598.80)', () => {
    // round(3992 * 15 / 100, 2) = round(598.80, 2) = 598.80
    expect(computeCommissionAmount(3992, 15)).toBe(598.80)
  })

  it('returns 0 when commission_pct is 0', () => {
    expect(computeCommissionAmount(4990, 0)).toBe(0)
  })

  it('handles 100% commission', () => {
    expect(computeCommissionAmount(100, 100)).toBe(100)
  })

  it('rounds to 2 decimal places', () => {
    // 1234.56 * 33.33 / 100 = 411.4796... → round → 411.48
    // 1234.56 * 16.67 / 100 = 205.8011... → round → 205.80
    expect(computeCommissionAmount(1234.56, 33.33)).toBe(411.48)
    expect(computeCommissionAmount(1234.56, 16.67)).toBe(205.80)
  })

  it('handles very small commissions (1% of 1000)', () => {
    expect(computeCommissionAmount(1000, 1)).toBe(10)
  })
})

describe('buildCommissionRecord', () => {
  const baseInput: ReferralCommissionInput = {
    workshopId: 'w1',
    youtuberId: 'y1',
    referralCodeId: 'rc1',
    subscriptionId: 'sub1',
    providerPaymentId: 'mp_pay_123',
    paymentAmount: 4990,
    commissionPct: 15,
    occurredAt: '2026-06-15T12:00:00Z',
  }

  it('returns a complete commission record with computed amount', () => {
    const record = buildCommissionRecord(baseInput)

    expect(record.workshop_id).toBe('w1')
    expect(record.youtuber_id).toBe('y1')
    expect(record.referral_code_id).toBe('rc1')
    expect(record.subscription_id).toBe('sub1')
    expect(record.provider_payment_id).toBe('mp_pay_123')
    expect(record.payment_amount).toBe(4990)
    expect(record.commission_pct).toBe(15)
    // 15% of 4990 = 748.50
    expect(record.commission_amount).toBe(748.50)
    expect(record.currency).toBe('ARS')
    expect(record.occurred_at).toBe('2026-06-15T12:00:00Z')
  })

  it('defaults currency to ARS', () => {
    const { currency } = buildCommissionRecord({
      ...baseInput,
      currency: undefined as unknown as string,
    })
    expect(currency).toBe('ARS')
  })

  it('allows overriding currency', () => {
    const { currency } = buildCommissionRecord({
      ...baseInput,
      currency: 'USD',
    })
    expect(currency).toBe('USD')
  })

  it('computes commission_amount from payment_amount and commission_pct', () => {
    // 15% of 3992 (discounted first payment) = 598.80
    const record = buildCommissionRecord({
      ...baseInput,
      paymentAmount: 3992,
      commissionPct: 15,
    })
    expect(record.payment_amount).toBe(3992)
    expect(record.commission_pct).toBe(15)
    expect(record.commission_amount).toBe(598.80)
  })
})

describe('recordCommissionIfReferred', () => {
  const workshopRef = {
    youtuber_id: 'y1',
    referral_code_id: 'rc1',
    referral_codes: { commission_pct: 15 },
  }

  it('skips when no attribution is found', async () => {
    const result = await recordCommissionIfReferred(
      createFakeSupabase({ workshopRef: null }),
      recordingParams,
    )

    expect(result).toEqual({
      recorded: false,
      skipped: true,
      duplicate: false,
      reason: 'no_attribution',
    })
  })

  it('records a commission for an attributed workshop', async () => {
    const result = await recordCommissionIfReferred(
      createFakeSupabase({ workshopRef }),
      recordingParams,
    )

    expect(result).toEqual({
      recorded: true,
      skipped: false,
      duplicate: false,
      record: expect.objectContaining({
        workshop_id: 'w1',
        youtuber_id: 'y1',
        referral_code_id: 'rc1',
        subscription_id: 'sub1',
        provider_payment_id: 'mp_pay_123',
        payment_amount: 4990,
        commission_pct: 15,
        commission_amount: 748.50,
        currency: 'ARS',
        occurred_at: '2026-06-15T12:00:00Z',
      }),
    })
  })

  it('returns duplicate when the commission insert hits unique violation 23505', async () => {
    const result = await recordCommissionIfReferred(
      createFakeSupabase({
        workshopRef,
        insertError: { message: 'duplicate key value', code: '23505' },
      }),
      recordingParams,
    )

    expect(result).toEqual({ recorded: false, skipped: false, duplicate: true })
  })

  it('returns an error when attribution lookup fails', async () => {
    const result = await recordCommissionIfReferred(
      createFakeSupabase({
        workshopRef: null,
        lookupError: { message: 'lookup failed' },
      }),
      recordingParams,
    )

    expect(result).toEqual({
      recorded: false,
      skipped: false,
      duplicate: false,
      reason: 'lookup failed',
    })
  })

  it('returns an error when commission insert fails', async () => {
    const result = await recordCommissionIfReferred(
      createFakeSupabase({
        workshopRef,
        insertError: { message: 'insert failed' },
      }),
      recordingParams,
    )

    expect(result).toEqual({
      recorded: false,
      skipped: false,
      duplicate: false,
      reason: 'insert failed',
    })
  })
})
