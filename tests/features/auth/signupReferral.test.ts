import { describe, it, expect } from 'vitest'

/**
 * These tests verify the pure metadata-building logic extracted
 * from LoginPage. The function `buildSignupMetadata` does not
 * exist yet at module `@/features/auth/lib/referralMetadata`.
 *
 * Scenarios (from spec Part 3, Domain: Referral Code Accepted at Signup):
 * 1. URL with ref populates metadata
 * 2. URL without ref leaves metadata clean
 * 3. Missing referral_code key is a no-op
 */

// Static import — will FAIL in RED phase because the module doesn't exist yet.
// After GREEN phase this import resolves normally.
import { buildSignupMetadata } from '@/features/auth/lib/referralMetadata'

const BASE = {
  workshop_name: 'Mi Taller',
  terms_accepted_at: '2026-06-15T00:00:00Z',
  privacy_accepted_at: '2026-06-15T00:00:00Z',
}

describe('buildSignupMetadata', () => {
  it('includes referral_code when refCode is provided', () => {
    const result = buildSignupMetadata(BASE, 'PROMO20')

    expect(result).toEqual({
      ...BASE,
      referral_code: 'PROMO20',
    })
  })

  it('omits referral_code when refCode is null', () => {
    const result = buildSignupMetadata(BASE, null)

    expect(result).toEqual(BASE)
    expect(result).not.toHaveProperty('referral_code')
  })

  it('omits referral_code when refCode is undefined', () => {
    const result = buildSignupMetadata(BASE, undefined)

    expect(result).toEqual(BASE)
    expect(result).not.toHaveProperty('referral_code')
  })

  it('omits referral_code when refCode is empty string', () => {
    const result = buildSignupMetadata(BASE, '')

    expect(result).toEqual(BASE)
    expect(result).not.toHaveProperty('referral_code')
  })

  it('does not mutate the base metadata object', () => {
    const original = { ...BASE }
    buildSignupMetadata(original, 'PROMO20')

    expect(original).toEqual(BASE)
    expect(original).not.toHaveProperty('referral_code')
  })
})
