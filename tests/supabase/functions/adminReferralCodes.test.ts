import { describe, it, expect } from 'vitest'
import {
  validateCreateCode,
  validateDeactivateCode,
  validateListCodes,
  checkCodeConflict,
  type ReferralCodeCreateInput,
} from '../../../supabase/functions/admin-referral-codes/validate'

describe('admin-referral-codes / validateCreateCode', () => {
  it('accepts valid create input', () => {
    const input: ReferralCodeCreateInput = {
      youtuberId: 'yt-1',
      code: 'PROMO20',
      discountPct: 20,
      commissionPct: 15,
    }

    const result = validateCreateCode(input)
    expect(result).toEqual({ ok: true, data: input })
  })

  it('accepts zero percentage values', () => {
    const input: ReferralCodeCreateInput = {
      youtuberId: 'yt-1',
      code: 'FREE',
      discountPct: 0,
      commissionPct: 0,
    }

    const result = validateCreateCode(input)
    expect(result).toEqual({ ok: true, data: input })
  })

  it('accepts 100 percentage values', () => {
    const input: ReferralCodeCreateInput = {
      youtuberId: 'yt-1',
      code: 'FULL',
      discountPct: 100,
      commissionPct: 100,
    }

    const result = validateCreateCode(input)
    expect(result).toEqual({ ok: true, data: input })
  })

  it('rejects missing youtuberId', () => {
    const input: ReferralCodeCreateInput = {
      youtuberId: '',
      code: 'PROMO20',
      discountPct: 20,
      commissionPct: 15,
    }

    const result = validateCreateCode(input)
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'youtuberId is required' },
    })
  })

  it('rejects empty code', () => {
    const input: ReferralCodeCreateInput = {
      youtuberId: 'yt-1',
      code: '',
      discountPct: 20,
      commissionPct: 15,
    }

    const result = validateCreateCode(input)
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'code is required' },
    })
  })

  it('rejects discountPct > 100', () => {
    const input: ReferralCodeCreateInput = {
      youtuberId: 'yt-1',
      code: 'INVALID',
      discountPct: 150,
      commissionPct: 15,
    }

    const result = validateCreateCode(input)
    expect(result).toEqual({
      ok: false,
      error: { code: 'referral_code_invalid_percentage', message: 'discount_pct must be between 0 and 100' },
    })
  })

  it('rejects commissionPct > 100', () => {
    const input: ReferralCodeCreateInput = {
      youtuberId: 'yt-1',
      code: 'INVALID',
      discountPct: 20,
      commissionPct: 200,
    }

    const result = validateCreateCode(input)
    expect(result).toEqual({
      ok: false,
      error: { code: 'referral_code_invalid_percentage', message: 'commission_pct must be between 0 and 100' },
    })
  })

  it('rejects negative discountPct', () => {
    const input: ReferralCodeCreateInput = {
      youtuberId: 'yt-1',
      code: 'NEG',
      discountPct: -5,
      commissionPct: 15,
    }

    const result = validateCreateCode(input)
    expect(result).toEqual({
      ok: false,
      error: { code: 'referral_code_invalid_percentage', message: 'discount_pct must be between 0 and 100' },
    })
  })

  it('rejects negative commissionPct', () => {
    const input: ReferralCodeCreateInput = {
      youtuberId: 'yt-1',
      code: 'NEG',
      discountPct: 20,
      commissionPct: -1,
    }

    const result = validateCreateCode(input)
    expect(result).toEqual({
      ok: false,
      error: { code: 'referral_code_invalid_percentage', message: 'commission_pct must be between 0 and 100' },
    })
  })
})

describe('admin-referral-codes / validateDeactivateCode', () => {
  it('accepts valid deactivate input', () => {
    const result = validateDeactivateCode('rc-1')
    expect(result).toEqual({ ok: true, data: { id: 'rc-1' } })
  })

  it('rejects missing id', () => {
    const result = validateDeactivateCode('')
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_error', message: 'id is required for deactivate' },
    })
  })
})

describe('admin-referral-codes / validateListCodes', () => {
  it('accepts list with optional youtuberId', () => {
    expect(validateListCodes('yt-1')).toEqual({ ok: true, data: { youtuberId: 'yt-1' } })
    expect(validateListCodes(undefined)).toEqual({ ok: true, data: {} })
  })
})

describe('admin-referral-codes / checkCodeConflict', () => {
  it('detects conflict when code exists', () => {
    const result = checkCodeConflict(
      [{ id: 'rc-1', code: 'PROMO20' }],
      'PROMO20',
    )
    expect(result).toEqual({
      hasConflict: true,
      error: { code: 'referral_code_conflict', message: 'Code PROMO20 already exists' },
    })
  })

  it('detects conflict case-insensitively', () => {
    const result = checkCodeConflict(
      [{ id: 'rc-1', code: 'PROMO20' }],
      'promo20',
    )
    expect(result.hasConflict).toBe(true)
  })

  it('returns no conflict when code does not exist', () => {
    const result = checkCodeConflict(
      [{ id: 'rc-1', code: 'PROMO20' }],
      'NEWCODE',
    )
    expect(result).toEqual({ hasConflict: false })
  })

  it('returns no conflict when existing codes are empty', () => {
    const result = checkCodeConflict([], 'PROMO20')
    expect(result).toEqual({ hasConflict: false })
  })
})
