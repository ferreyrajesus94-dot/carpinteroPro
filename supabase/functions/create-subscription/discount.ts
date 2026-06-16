/**
 * Pure discount calculation for create-subscription Edge Function.
 * Extracted for testability — no Deno dependencies.
 */

export interface ReferralInfo {
  /** Discount percentage from the referral code (0-100) */
  discountPct: number
  /** Whether the code is currently active */
  codeActive: boolean
}

export interface DiscountResult {
  /** The final amount after discount (or full price if no discount applied) */
  amount: number
  /** Whether a discount was actually applied */
  discountApplied: boolean
  /** The discount percentage used (null if no referral or inactive code) */
  discountPct: number | null
}

export interface SubscriptionDiscountState {
  providerPreapprovalId: string | null
  status: string | null
}

export interface SubscriptionUpsertPayloadInput {
  workshopId: string
  status: string
  plan: string
  providerPreapprovalId: string
  providerStatus: string | undefined
  firstPeriodDiscountPct: number | null
  referredByReferralCodeId: string | null
}

export interface SubscriptionUpsertPayload {
  workshop_id: string
  status: string
  plan: string
  provider: 'mercadopago'
  provider_preapproval_id: string
  provider_status: string | undefined
  first_period_discount_pct: number | null
  referred_by_referral_code_id: string | null
}

/**
 * Compute the subscription amount based on referral info.
 *
 * @param basePrice - Standard monthly price (e.g. 4990)
 * @param referral - Referral info or null if no attribution exists
 * @returns DiscountResult with the computed amount and metadata
 */
export function computeSubscriptionAmount(
  basePrice: number,
  referral: ReferralInfo | null,
): DiscountResult {
  // No referral attribution or inactive code → full price
  if (!referral || !referral.codeActive) {
    return {
      amount: basePrice,
      discountApplied: false,
      discountPct: null,
    }
  }

  // Apply discount: round(basePrice * (1 - discountPct / 100), 2)
  const discounted = Math.round(
    basePrice * (1 - referral.discountPct / 100) * 100,
  ) / 100

  return {
    amount: discounted,
    discountApplied: true,
    discountPct: referral.discountPct,
  }
}

export function shouldComputeReferralDiscount(
  subscription: SubscriptionDiscountState | null,
): boolean {
  return !subscription?.providerPreapprovalId
}

export function buildSubscriptionUpsertPayload(
  input: SubscriptionUpsertPayloadInput,
): SubscriptionUpsertPayload {
  return {
    workshop_id: input.workshopId,
    status: input.status,
    plan: input.plan,
    provider: 'mercadopago',
    provider_preapproval_id: input.providerPreapprovalId,
    provider_status: input.providerStatus,
    first_period_discount_pct: input.firstPeriodDiscountPct,
    referred_by_referral_code_id: input.referredByReferralCodeId,
  }
}
