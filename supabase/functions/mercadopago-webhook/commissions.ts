/**
 * Commission computation, record building, and idempotent recording logic
 * for referral commissions. Pure computation functions have no external
 * dependencies. The recordCommissionIfReferred helper requires a Supabase
 * client for DB interaction.
 */

export interface ReferralCommissionInput {
  /** Workshop that was referred */
  workshopId: string
  /** YouTuber who referred this workshop */
  youtuberId: string
  /** Referral code used for attribution */
  referralCodeId: string
  /** Subscription that received the payment */
  subscriptionId: string
  /** MP authorized payment ID (unique, for idempotency) */
  providerPaymentId: string
  /** Actual amount paid by the workshop */
  paymentAmount: number
  /** Commission percentage from the referral code (0-100) */
  commissionPct: number
  /** ISO timestamp when the payment occurred */
  occurredAt: string
  /** Currency code (defaults to 'ARS') */
  currency?: string
}

export interface CommissionRecord {
  workshop_id: string
  youtuber_id: string
  referral_code_id: string
  subscription_id: string
  provider_payment_id: string
  payment_amount: number
  commission_pct: number
  commission_amount: number
  currency: string
  occurred_at: string
}

/**
 * Compute the commission amount from the payment amount and commission percentage.
 *
 * @param paymentAmount - The actual amount paid by the workshop
 * @param commissionPct - The commission percentage (0-100)
 * @returns The commission amount rounded to 2 decimal places
 */
export function computeCommissionAmount(
  paymentAmount: number,
  commissionPct: number,
): number {
  return Math.round(paymentAmount * (commissionPct / 100) * 100) / 100
}

/**
 * Build a complete referral_commissions DB record from input data.
 *
 * @param input - The referral commission input data
 * @returns A complete CommissionRecord ready for DB insertion
 */
export function buildCommissionRecord(
  input: ReferralCommissionInput,
): CommissionRecord {
  return {
    workshop_id: input.workshopId,
    youtuber_id: input.youtuberId,
    referral_code_id: input.referralCodeId,
    subscription_id: input.subscriptionId,
    provider_payment_id: input.providerPaymentId,
    payment_amount: input.paymentAmount,
    commission_pct: input.commissionPct,
    commission_amount: computeCommissionAmount(
      input.paymentAmount,
      input.commissionPct,
    ),
    currency: input.currency ?? 'ARS',
    occurred_at: input.occurredAt,
  }
}

/**
 * Result of attempting to record a referral commission.
 */
export interface CommissionRecordingResult {
  /** Whether a commission row was successfully inserted */
  recorded: boolean
  /** Whether recording was skipped (no attribution or non-approved payment) */
  skipped: boolean
  /** Whether insert hit a 23505 duplicate (already processed) */
  duplicate: boolean
  /** Human-readable reason if recording was skipped or failed */
  reason?: string
  /** Inserted commission record when recording succeeds */
  record?: CommissionRecord
}

/**
 * Minimal Supabase client interface — only the methods this helper needs.
 */
interface SupabaseQuery {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string; code?: string } | null }>
      }
    }
    insert(values: Record<string, unknown>): Promise<{ error: { message: string; code?: string } | null }>
  }
}

/**
 * Attempt to record a commission for a referred workshop's approved payment.
 *
 * Looks up workshop_referrals for the given workshop_id. If attribution
 * exists, builds and inserts a commission record. Handles idempotency via
 * 23505 unique-violation catch.
 *
 * @param supabase - Supabase client (service role for RLS bypass)
 * @param params - Commission recording parameters
 * @returns CommissionRecordingResult describing what happened
 */
export async function recordCommissionIfReferred(
  supabase: SupabaseQuery,
  params: {
    workshopId: string
    subscriptionId: string
    providerPaymentId: string
    paymentAmount: number
    occurredAt: string
  },
): Promise<CommissionRecordingResult> {
  const { data: workshopRef, error: refError } = await supabase
    .from("workshop_referrals")
    .select(
      "youtuber_id, referral_code_id, referral_codes!inner(commission_pct)",
    )
    .eq("workshop_id", params.workshopId)
    .maybeSingle()

  if (refError) {
    return {
      recorded: false,
      skipped: false,
      duplicate: false,
      reason: refError.message,
    }
  }

  if (!workshopRef) {
    return { recorded: false, skipped: true, duplicate: false, reason: "no_attribution" }
  }

  const rc = workshopRef.referral_codes as { commission_pct: number }
  const record = buildCommissionRecord({
    workshopId: params.workshopId,
    youtuberId: workshopRef.youtuber_id as string,
    referralCodeId: workshopRef.referral_code_id as string,
    subscriptionId: params.subscriptionId,
    providerPaymentId: params.providerPaymentId,
    paymentAmount: params.paymentAmount,
    commissionPct: rc.commission_pct,
    occurredAt: params.occurredAt,
  })

  const { error: commissionError } = await supabase
    .from("referral_commissions")
    .insert(record as unknown as Record<string, unknown>)

  if (commissionError) {
    if (commissionError.code === "23505") {
      return { recorded: false, skipped: false, duplicate: true }
    }
    return {
      recorded: false,
      skipped: false,
      duplicate: false,
      reason: commissionError.message,
    }
  }

  return { recorded: true, skipped: false, duplicate: false, record }
}
