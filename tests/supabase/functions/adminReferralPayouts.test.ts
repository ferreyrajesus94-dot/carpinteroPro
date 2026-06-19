import { describe, it, expect } from "vitest";

// We'll test pure functions from the payouts module
// Functions need to be created first, then tests will pass

// ===== Step 2.1: computePayoutTotal =====
describe("computePayoutTotal", () => {
	it("sums commission amounts correctly", async () => {
		const { computePayoutTotal } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const commissions = [
			{ commissionAmount: 100.5 },
			{ commissionAmount: 200.0 },
			{ commissionAmount: 150.25 },
		];
		expect(computePayoutTotal(commissions)).toBe(450.75);
	});

	it("returns 0 for empty array", async () => {
		const { computePayoutTotal } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		expect(computePayoutTotal([])).toBe(0);
	});

	it("handles single commission", async () => {
		const { computePayoutTotal } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		expect(computePayoutTotal([{ commissionAmount: 99.99 }])).toBe(99.99);
	});

	it("handles decimal precision correctly", async () => {
		const { computePayoutTotal } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const commissions = [
			{ commissionAmount: 100.1 },
			{ commissionAmount: 200.2 },
			{ commissionAmount: 150.3 },
		];
		expect(computePayoutTotal(commissions)).toBeCloseTo(450.6, 2);
	});
});

// ===== Step 2.2: validateBankDetails =====
describe("validateBankDetails", () => {
	it("returns valid for correct CBU (22 digits)", async () => {
		const { validateBankDetails } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const result = validateBankDetails({ payoutCbu: "1234567890123456789012" });
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual({});
	});

	it("returns error for too short CBU", async () => {
		const { validateBankDetails } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const result = validateBankDetails({ payoutCbu: "123" });
		expect(result.valid).toBe(false);
		expect(result.errors.payoutCbu).toMatch(/22 dígitos/i);
	});

	it("returns error for CBU with non-digit characters", async () => {
		const { validateBankDetails } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const result = validateBankDetails({ payoutCbu: "ABCDEFGHIJKLMNOPQRST" });
		expect(result.valid).toBe(false);
		expect(result.errors.payoutCbu).toBeDefined();
	});

	it("returns valid for correct CVU (23 digits)", async () => {
		const { validateBankDetails } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const result = validateBankDetails({
			payoutCvu: "12345678901234567890123",
		});
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual({});
	});

	it("returns error for too long CVU", async () => {
		const { validateBankDetails } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const result = validateBankDetails({
			payoutCvu: "123456789012345678901234",
		});
		expect(result.valid).toBe(false);
		expect(result.errors.payoutCvu).toMatch(/23 dígitos/i);
	});

	it("returns error for invalid CUIT format", async () => {
		const { validateBankDetails } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const result = validateBankDetails({ payoutHolderCuit: "12345678901" });
		expect(result.valid).toBe(false);
		expect(result.errors.payoutHolderCuit).toMatch(/formato/i);
	});

	it("returns valid for correct CUIT format", async () => {
		const { validateBankDetails } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const result = validateBankDetails({ payoutHolderCuit: "20-12345678-9" });
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual({});
	});

	it("allows empty bank details (partial save)", async () => {
		const { validateBankDetails } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const result = validateBankDetails({});
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual({});
	});

	it("validates multiple fields at once", async () => {
		const { validateBankDetails } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const result = validateBankDetails({
			payoutCbu: "123",
			payoutCvu: "456",
			payoutHolderCuit: "bad",
		});
		expect(result.valid).toBe(false);
		expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(2);
	});
});

// ===== Step 2.3: buildPayoutRunRecord =====
describe("buildPayoutRunRecord", () => {
	it("builds correct record with all fields", async () => {
		const { buildPayoutRunRecord } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const record = buildPayoutRunRecord({
			commissionIds: ["c1", "c2"],
			totalAmount: 450.0,
			reference: "TRANSFER-123",
			notes: "Pago mensual",
			createdBy: "admin-uuid",
		});
		expect(record.created_by).toBe("admin-uuid");
		expect(record.total_amount).toBe(450.0);
		expect(record.commission_count).toBe(2);
		expect(record.reference).toBe("TRANSFER-123");
		expect(record.notes).toBe("Pago mensual");
		expect(record.id).toBeDefined();
	});

	it("handles missing optional fields", async () => {
		const { buildPayoutRunRecord } = await import(
			"../../../supabase/functions/admin-referral-payouts/payouts"
		);
		const record = buildPayoutRunRecord({
			commissionIds: ["c1"],
			totalAmount: 100.0,
			createdBy: "admin-uuid",
		});
		expect(record.commission_count).toBe(1);
		expect(record.reference).toBeNull();
		expect(record.notes).toBeNull();
	});
});

// ===== Step 2.5: pending-by-youtuber mapping =====
describe("buildPendingByYoutuberResponse", () => {
	it("groups commissions by youtuber and returns correct structure", async () => {
		const { buildPendingByYoutuberResponse } = await import(
			"../../../supabase/functions/admin-referral-payouts/mapping"
		);
		const commissions = [
			{
				id: "c1",
				youtuber_id: "yt-1",
				youtuber_name: "Canal Madera",
				commission_amount: 100,
				occurred_at: "2026-01-15T10:00:00Z",
				workshop_name: "Taller A",
			},
			{
				id: "c2",
				youtuber_id: "yt-1",
				youtuber_name: "Canal Madera",
				commission_amount: 200,
				occurred_at: "2026-02-15T10:00:00Z",
				workshop_name: "Taller B",
			},
			{
				id: "c3",
				youtuber_id: "yt-2",
				youtuber_name: "El Taller Carpintero",
				commission_amount: 150,
				occurred_at: "2026-03-01T10:00:00Z",
				workshop_name: "Taller C",
			},
		];
		const result = buildPendingByYoutuberResponse(commissions);
		expect(result.youtubers).toHaveLength(2);

		// First youtuber (highest total) should be first
		expect(result.youtubers[0].youtuberId).toBe("yt-1");
		expect(result.youtubers[0].displayName).toBe("Canal Madera");
		expect(result.youtubers[0].totalPendingAmount).toBe(300);
		expect(result.youtubers[0].commissionCount).toBe(2);
		expect(result.youtubers[0].commissions).toHaveLength(2);

		expect(result.youtubers[1].youtuberId).toBe("yt-2");
		expect(result.youtubers[1].totalPendingAmount).toBe(150);
		expect(result.youtubers[1].commissionCount).toBe(1);
		expect(result.youtubers[1].commissions).toHaveLength(1);

		// Commission structure
		const c = result.youtubers[0].commissions[0];
		expect(c.id).toBeDefined();
		expect(c.commissionAmount).toBeDefined();
		expect(c.occurredAt).toBeDefined();
		expect(c.workshopName).toBeDefined();
	});

	it("returns empty youtubers array for empty input", async () => {
		const { buildPendingByYoutuberResponse } = await import(
			"../../../supabase/functions/admin-referral-payouts/mapping"
		);
		const result = buildPendingByYoutuberResponse([]);
		expect(result.youtubers).toHaveLength(0);
	});
});

// ===== Step 2.10: payout history mapping =====
describe("mapPayoutHistoryRows", () => {
	it("flattens Supabase nested payout history rows", async () => {
		const { mapPayoutHistoryRows } = await import(
			"../../../supabase/functions/admin-referral-payouts/mapping"
		);
		const rows = [
			{
				id: "pr-1",
				created_by: "admin-1",
				total_amount: "450.00",
				commission_count: 2,
				reference: "TRANSFER-123",
				notes: "Pago mensual",
				created_at: "2026-03-01T10:00:00Z",
				profiles: { display_name: "Admin Local" },
				referral_commissions: [
					{
						id: "c1",
						commission_amount: "200.00",
						youtuber_id: "yt-1",
						occurred_at: "2026-02-15T10:00:00Z",
						youtubers: { display_name: "Canal Madera" },
						workshops: { name: "Taller A" },
					},
					{
						id: "c2",
						commission_amount: "250.00",
						youtuber_id: "yt-1",
						occurred_at: "2026-02-20T10:00:00Z",
						youtubers: { display_name: "Canal Madera" },
						workshops: { name: "Taller B" },
					},
				],
			},
		];

		const result = mapPayoutHistoryRows(rows);

		expect(result).toHaveLength(1);
		expect(result[0].admin_email).toBe("Admin Local");
		expect(result[0].commissions).toHaveLength(2);
		expect(result[0].commissions[0]).toMatchObject({
			id: "c1",
			commission_amount: 200,
			youtuber_name: "Canal Madera",
			workshop_name: "Taller A",
		});
	});
});

describe("buildPayoutHistoryResponse", () => {
	it("formats payout runs with nested commissions", async () => {
		const { buildPayoutHistoryResponse } = await import(
			"../../../supabase/functions/admin-referral-payouts/mapping"
		);
		const runs = [
			{
				id: "pr-1",
				created_by: "admin-1",
				total_amount: 450,
				commission_count: 3,
				reference: "TRANSFER-123",
				notes: "Pago mensual",
				created_at: "2026-03-01T10:00:00Z",
				admin_email: "admin@example.com",
				commissions: [
					{
						id: "c1",
						commission_amount: 200,
						youtuber_name: "Canal Madera",
						workshop_name: "Taller A",
					},
					{
						id: "c2",
						commission_amount: 250,
						youtuber_name: "Canal Madera",
						workshop_name: "Taller B",
					},
				],
			},
		];
		const result = buildPayoutHistoryResponse(runs);
		expect(result.payoutRuns).toHaveLength(1);
		const r = result.payoutRuns[0];
		expect(r.id).toBe("pr-1");
		expect(r.totalAmount).toBe(450);
		expect(r.commissionCount).toBe(3);
		expect(r.reference).toBe("TRANSFER-123");
		expect(r.createdAt).toBe("2026-03-01T10:00:00Z");
		expect(r.commissions).toHaveLength(2);
		expect(r.commissions[0].commissionAmount).toBe(200);
	});

	it("returns empty array for no runs", async () => {
		const { buildPayoutHistoryResponse } = await import(
			"../../../supabase/functions/admin-referral-payouts/mapping"
		);
		const result = buildPayoutHistoryResponse([]);
		expect(result.payoutRuns).toHaveLength(0);
	});
});
