/**
 * Integration test for the payout workflow.
 * Tests the chain: pending-by-youtuber → build response → mark-paid → history.
 * Pure functions only, no Supabase connectivity needed.
 */
import { describe, it, expect } from 'vitest'

import {
  computePayoutTotal,
  buildPayoutRunRecord,
  validateBankDetails,
} from '../../supabase/functions/admin-referral-payouts/payouts'

import {
  buildPendingByYoutuberResponse,
  buildPayoutHistoryResponse,
  validatePayoutRequest,
} from '../../supabase/functions/admin-referral-payouts/mapping'

describe('Payout Workflow Integration', () => {
  it('full chain: commissions → pending-by-youtuber → mark-paid → history', () => {
    // Arrange: Simulate pending commissions from DB
    const pendingCommissions = [
      {
        id: 'c1',
        youtuber_id: 'yt-1',
        youtuber_name: 'Canal Madera',
        commission_amount: 250.00,
        occurred_at: '2026-01-15T10:00:00Z',
        workshop_name: 'Taller del Este',
      },
      {
        id: 'c2',
        youtuber_id: 'yt-1',
        youtuber_name: 'Canal Madera',
        commission_amount: 150.00,
        occurred_at: '2026-02-15T10:00:00Z',
        workshop_name: 'Taller del Oeste',
      },
    ]

    // Act 1: Build pending-by-youtuber response
    const pendingResponse = buildPendingByYoutuberResponse(pendingCommissions)

    // Assert 1: Correct grouping
    expect(pendingResponse.youtubers).toHaveLength(1)
    expect(pendingResponse.youtubers[0].displayName).toBe('Canal Madera')
    expect(pendingResponse.youtubers[0].totalPendingAmount).toBe(400.00)
    expect(pendingResponse.youtubers[0].commissionCount).toBe(2)

    // Act 2: Compute total
    const total = computePayoutTotal(
      pendingCommissions.map((c) => ({
        commissionAmount: c.commission_amount,
      })),
    )
    expect(total).toBe(400.00)

    // Act 3: Build payout run record
    const payoutRun = buildPayoutRunRecord({
      commissionIds: ['c1', 'c2'],
      totalAmount: total,
      reference: 'TRANSFER-999',
      notes: 'Integration test payout',
      createdBy: 'admin-1',
    })

    expect(payoutRun.total_amount).toBe(400.00)
    expect(payoutRun.commission_count).toBe(2)
    expect(payoutRun.reference).toBe('TRANSFER-999')
    expect(payoutRun.notes).toBe('Integration test payout')
    expect(payoutRun.created_by).toBe('admin-1')
    expect(payoutRun.id).toBeDefined()

    // Act 4: Build payout history response (simulating the history query result)
    const historyData = [
      {
        id: payoutRun.id,
        created_by: payoutRun.created_by,
        total_amount: payoutRun.total_amount,
        commission_count: payoutRun.commission_count,
        reference: payoutRun.reference,
        notes: payoutRun.notes,
        created_at: '2026-03-01T10:00:00Z',
        admin_email: 'admin@example.com',
        commissions: [
          {
            id: 'c1',
            commission_amount: 250.00,
            youtuber_name: 'Canal Madera',
            workshop_name: 'Taller del Este',
          },
          {
            id: 'c2',
            commission_amount: 150.00,
            youtuber_name: 'Canal Madera',
            workshop_name: 'Taller del Oeste',
          },
        ],
      },
    ]

    const historyResponse = buildPayoutHistoryResponse(historyData)
    expect(historyResponse.payoutRuns).toHaveLength(1)
    expect(historyResponse.payoutRuns[0].totalAmount).toBe(400.00)
    expect(historyResponse.payoutRuns[0].reference).toBe('TRANSFER-999')
    expect(historyResponse.payoutRuns[0].commissions).toHaveLength(2)
    expect(historyResponse.payoutRuns[0].createdBy).toBe('admin@example.com')
  })

  it('validates payout request schema for all actions', () => {
    // Valid mark-paid
    const valid = validatePayoutRequest({
      action: 'mark-paid',
      commissionIds: ['c1', 'c2'],
      payoutReference: 'TRANSFER-001',
      notes: 'Test',
    })
    expect(valid.ok).toBe(true)

    // Invalid: empty commissionIds
    const invalid = validatePayoutRequest({
      action: 'mark-paid',
      commissionIds: [],
      payoutReference: 'REF',
    })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) {
      expect(invalid.error.code).toBe('validation_error')
    }

    // Valid pending-by-youtuber
    const pending = validatePayoutRequest({
      action: 'pending-by-youtuber',
      fromDate: '2026-01-01',
    })
    expect(pending.ok).toBe(true)

    // Valid payout-history
    const history = validatePayoutRequest({
      action: 'payout-history',
      limit: 10,
    })
    expect(history.ok).toBe(true)

    // Valid youtuber-bank-details
    const bank = validatePayoutRequest({
      action: 'youtuber-bank-details',
      youtuberId: 'yt-1',
    })
    expect(bank.ok).toBe(true)
  })

  it('validates bank details end-to-end', () => {
    // Valid bank details
    const valid = validateBankDetails({
      payoutCbu: '1234567890123456789012',
      payoutCvu: '12345678901234567890123',
      payoutHolderCuit: '20-12345678-9',
    })
    expect(valid.valid).toBe(true)

    // Invalid bank details
    const invalid = validateBankDetails({
      payoutCbu: '123',
      payoutCvu: '456',
      payoutHolderCuit: 'bad',
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.errors.payoutCbu).toBeDefined()
    expect(invalid.errors.payoutCvu).toBeDefined()
    expect(invalid.errors.payoutHolderCuit).toBeDefined()
  })

  it('handles empty and edge cases gracefully', () => {
    // Empty pending commissions
    const empty = buildPendingByYoutuberResponse([])
    expect(empty.youtubers).toHaveLength(0)

    // Empty payout history
    const noHistory = buildPayoutHistoryResponse([])
    expect(noHistory.payoutRuns).toHaveLength(0)

    // Single commission payout run
    const run = buildPayoutRunRecord({
      commissionIds: ['c1'],
      totalAmount: 100,
      createdBy: 'admin-1',
    })
    expect(run.commission_count).toBe(1)
    expect(run.total_amount).toBe(100)
    expect(run.reference).toBeNull()
    expect(run.notes).toBeNull()
  })
})
