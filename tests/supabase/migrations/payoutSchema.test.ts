/**
 * Migration-level assertions for SDD-12 Commission Payout Flow.
 * Tests read the SQL migration files as raw strings and validate
 * that expected columns, constraints, indexes, and RLS settings
 * are present in the migration statements.
 */
import { describe, expect, it } from 'vitest'

// ── Migration 1: YouTuber bank details ────────────────────────────
describe('20260618000001_youtuber_bank_details.sql', () => {
  it('resolves the module', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000001_youtuber_bank_details.sql?raw'
    )
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('string')
  })

  it('adds payout_cbu column', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000001_youtuber_bank_details.sql?raw'
    )
    expect(mod.default).toMatch(/payout_cbu\s+text/i)
  })

  it('adds payout_cvu column', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000001_youtuber_bank_details.sql?raw'
    )
    expect(mod.default).toMatch(/payout_cvu\s+text/i)
  })

  it('adds payout_alias column', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000001_youtuber_bank_details.sql?raw'
    )
    expect(mod.default).toMatch(/payout_alias\s+text/i)
  })

  it('adds payout_bank_name column', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000001_youtuber_bank_details.sql?raw'
    )
    expect(mod.default).toMatch(/payout_bank_name\s+text/i)
  })

  it('adds payout_holder_name column', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000001_youtuber_bank_details.sql?raw'
    )
    expect(mod.default).toMatch(/payout_holder_name\s+text/i)
  })

  it('adds payout_holder_cuit column', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000001_youtuber_bank_details.sql?raw'
    )
    expect(mod.default).toMatch(/payout_holder_cuit\s+text/i)
  })

  it('keeps existing payout_method column (legacy)', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000001_youtuber_bank_details.sql?raw'
    )
    expect(mod.default).not.toMatch(/drop\s+column\s+payout_method/i)
  })

  it('includes RLS assertion block', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000001_youtuber_bank_details.sql?raw'
    )
    expect(mod.default).toMatch(/relrowsecurity/i)
  })
})

// ── Migration 2: Commission payout status ─────────────────────────
describe('20260618000002_commission_status.sql', () => {
  it('resolves the module', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000002_commission_status.sql?raw'
    )
    expect(mod.default).toBeDefined()
  })

  it('adds status column with CHECK constraint', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000002_commission_status.sql?raw'
    )
    expect(mod.default).toMatch(/status\s+text/i)
    expect(mod.default).toMatch(/check\s*\(/i)
    expect(mod.default).toMatch(/pending/i)
    expect(mod.default).toMatch(/paid/i)
    expect(mod.default).toMatch(/cancelled/i)
  })

  it('adds paid_at timestamptz column', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000002_commission_status.sql?raw'
    )
    expect(mod.default).toMatch(/paid_at\s+timestamptz/i)
  })

  it('adds payout_reference column', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000002_commission_status.sql?raw'
    )
    expect(mod.default).toMatch(/payout_reference\s+text/i)
  })

  it('adds payout_run_id column (FK in next migration)', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000002_commission_status.sql?raw'
    )
    expect(mod.default).toMatch(/payout_run_id\s+uuid/i)
  })

  it('creates partial index on status = pending', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000002_commission_status.sql?raw'
    )
    expect(mod.default).toMatch(/CREATE INDEX referral_commissions_pending_idx/i)
    expect(mod.default).toMatch(/WHERE status = .pending./i)
  })

  it('includes RLS assertion block', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000002_commission_status.sql?raw'
    )
    expect(mod.default).toMatch(/relrowsecurity/i)
  })
})

// ── Migration 3: Payout runs table ────────────────────────────────
describe('20260618000003_payout_runs.sql', () => {
  it('resolves the module', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toBeDefined()
  })

  it('creates payout_runs table', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?public\.payout_runs/i)
  })

  it('has uuid primary key', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/id\s+uuid\s+primary\s+key/i)
  })

  it('has created_by column referencing profiles', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/created_by\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.profiles\(id\)/i)
  })

  it('has total_amount numeric(12,2)', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/total_amount\s+numeric\s*\(\s*12\s*,\s*2\s*\)/i)
  })

  it('has commission_count int', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/commission_count\s+int/i)
  })

  it('has reference text column', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/reference\s+text/i)
  })

  it('has notes text column', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/notes\s+text/i)
  })

  it('has created_at with default now()', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/created_at\s+timestamptz/i)
    expect(mod.default).toMatch(/default\s+now\(\)/i)
  })

  it('has no workshop_id column (platform-global)', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    // payout_runs must NOT have workshop_id as a column definition
    // (comments mentioning workshop_id are fine)
    expect(mod.default).not.toMatch(/workshop_id\s+uuid/i)
  })

  it('enables RLS on payout_runs', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/enable\s+row\s+level\s+security/i)
  })

  it('adds FK from referral_commissions.payout_run_id to payout_runs.id with ON DELETE SET NULL', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/foreign\s+key\s*\(\s*payout_run_id\s*\)/i)
    expect(mod.default).toMatch(/on\s+delete\s+set\s+null/i)
  })

  it('includes RLS assertion block', async () => {
    const mod = await import(
      '../../../supabase/migrations/20260618000003_payout_runs.sql?raw'
    )
    expect(mod.default).toMatch(/relrowsecurity/i)
  })
})
