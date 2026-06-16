import { describe, expect, it } from 'vitest'
import migration from '../../../supabase/migrations/20260615000004_referral_program_commissions.sql?raw'

describe('referral_commissions migration ledger integrity', () => {
  it('prevents deleting youtubers that already have commission ledger rows', () => {
    expect(migration).toMatch(
      /youtuber_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.youtubers\(id\)\s+ON\s+DELETE\s+RESTRICT/i,
    )
  })

  it('prevents deleting referral codes that already have commission ledger rows', () => {
    expect(migration).toMatch(
      /referral_code_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.referral_codes\(id\)\s+ON\s+DELETE\s+RESTRICT/i,
    )
  })
})
