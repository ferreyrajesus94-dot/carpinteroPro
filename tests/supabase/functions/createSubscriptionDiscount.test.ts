import { describe, it, expect } from 'vitest'

/**
 * Tests for create-subscription discount logic.
 * The function `computeSubscriptionAmount` does not exist yet.
 *
 * Scenarios (from spec Part 2, Requirement: Discount Computation on First Preapproval):
 * 1. Referred workshop first preapproval is discounted
 * 2. Unreferred workshop gets full price
 * 3. Inactive code is ignored
 * 4. Discount recorded on first preapproval
 */
import {
  buildSubscriptionUpsertPayload,
  computeSubscriptionAmount,
  shouldComputeReferralDiscount,
} from '../../../supabase/functions/create-subscription/discount'

const BASE_PRICE = 4990

describe('computeSubscriptionAmount', () => {
  it('returns discounted amount for active referral', () => {
    const result = computeSubscriptionAmount(BASE_PRICE, {
      discountPct: 20,
      codeActive: true,
    })

    // round(4990 * (1 - 20/100), 2) = round(4990 * 0.80, 2) = 3992.00
    expect(result.amount).toBe(3992.00)
    expect(result.discountApplied).toBe(true)
    expect(result.discountPct).toBe(20)
  })

  it('returns full price when no referral exists', () => {
    const result = computeSubscriptionAmount(BASE_PRICE, null)

    expect(result.amount).toBe(4990)
    expect(result.discountApplied).toBe(false)
    expect(result.discountPct).toBeNull()
  })

  it('returns full price when referral code is inactive', () => {
    const result = computeSubscriptionAmount(BASE_PRICE, {
      discountPct: 10,
      codeActive: false,
    })

    expect(result.amount).toBe(4990)
    expect(result.discountApplied).toBe(false)
    expect(result.discountPct).toBeNull()
  })

  it('returns full price when discountPct is 0', () => {
    const result = computeSubscriptionAmount(BASE_PRICE, {
      discountPct: 0,
      codeActive: true,
    })

    expect(result.amount).toBe(4990)
    expect(result.discountApplied).toBe(true)
    expect(result.discountPct).toBe(0)
  })

  it('handles different discount percentages', () => {
    const result = computeSubscriptionAmount(BASE_PRICE, {
      discountPct: 50,
      codeActive: true,
    })

    // round(4990 * 0.50, 2) = 2495.00
    expect(result.amount).toBe(2495.00)
  })

  it('rounds to 2 decimal places', () => {
    // 4990 * (1 - 33.33/100) = 4990 * 0.6667 = 3326.833 -> round -> 3326.83
    const result = computeSubscriptionAmount(BASE_PRICE, {
      discountPct: 33.33,
      codeActive: true,
    })

    expect(result.amount).toBe(3326.83)
  })

  it('discountPct is passed through from the input', () => {
    const result = computeSubscriptionAmount(BASE_PRICE, {
      discountPct: 20,
      codeActive: true,
    })

    expect(result.discountPct).toBe(20)
  })
})

describe('shouldComputeReferralDiscount', () => {
  it('computes referral discounts only before the first preapproval', () => {
    expect(shouldComputeReferralDiscount(null)).toBe(true)
    expect(
      shouldComputeReferralDiscount({
        providerPreapprovalId: null,
        status: 'trialing',
      }),
    ).toBe(true)
  })

  it('does not compute referral discounts for cancelled workshops that resubscribe', () => {
    expect(
      shouldComputeReferralDiscount({
        providerPreapprovalId: 'preapproval_old',
        status: 'cancelled',
      }),
    ).toBe(false)
  })
})

describe('buildSubscriptionUpsertPayload', () => {
  it('clears stale discount audit columns when a cancelled workshop resubscribes without a first-period discount', () => {
    const payload = buildSubscriptionUpsertPayload({
      workshopId: 'workshop-1',
      status: 'cancelled',
      plan: 'pro_monthly',
      providerPreapprovalId: 'preapproval_new',
      providerStatus: 'pending',
      firstPeriodDiscountPct: null,
      referredByReferralCodeId: null,
    })

    expect(payload.first_period_discount_pct).toBeNull()
    expect(payload.referred_by_referral_code_id).toBeNull()
  })

  it('persists first-period discount audit columns when a first subscription discount applies', () => {
    const payload = buildSubscriptionUpsertPayload({
      workshopId: 'workshop-1',
      status: 'trialing',
      plan: 'pro_monthly',
      providerPreapprovalId: 'preapproval_new',
      providerStatus: 'pending',
      firstPeriodDiscountPct: 20,
      referredByReferralCodeId: 'code-1',
    })

    expect(payload.first_period_discount_pct).toBe(20)
    expect(payload.referred_by_referral_code_id).toBe('code-1')
  })
})
