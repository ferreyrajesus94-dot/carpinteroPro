// Request validation and response mapping for admin-referral-payouts Edge Function.

export interface PendingCommissionRow {
	id: string;
	youtuber_id: string;
	youtuber_name: string | null;
	commission_amount: number;
	occurred_at: string;
	workshop_name: string | null;
}

export interface PayoutRunWithCommissionsRow {
	id: string;
	created_by: string;
	total_amount: number;
	commission_count: number;
	reference: string | null;
	notes: string | null;
	created_at: string;
	admin_email: string | null;
	commissions: Array<{
		id: string;
		commission_amount: number;
		youtuber_name: string | null;
		workshop_name: string | null;
	}>;
}

export interface PendingByYoutuberGroup {
	youtuberId: string;
	displayName: string;
	totalPendingAmount: number;
	commissionCount: number;
	commissions: Array<{
		id: string;
		commissionAmount: number;
		occurredAt: string;
		workshopName: string | null;
	}>;
}

export interface PendingByYoutuberResponse {
	youtubers: PendingByYoutuberGroup[];
}

export interface PayoutRunSummary {
	id: string;
	createdAt: string;
	totalAmount: number;
	commissionCount: number;
	reference: string | null;
	notes: string | null;
	createdBy: string | null;
	commissions: Array<{
		id: string;
		commissionAmount: number;
		youtuberName: string | null;
		workshopName: string | null;
	}>;
}

export interface PayoutHistoryResponse {
	payoutRuns: PayoutRunSummary[];
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
	return value !== null && typeof value === "object"
		? (value as UnknownRecord)
		: null;
}

function asRecordArray(value: unknown): UnknownRecord[] {
	return Array.isArray(value)
		? value.flatMap((item) => {
				const record = asRecord(item);
				return record ? [record] : [];
			})
		: [];
}

export interface ValidationResultOk<T> {
	ok: true;
	data: T;
}

export interface ValidationResultErr {
	ok: false;
	error: { code: string; message: string };
}

export type ValidationResult<T> = ValidationResultOk<T> | ValidationResultErr;

export interface MarkPaidRequest {
	action: "mark-paid";
	commissionIds: string[];
	payoutReference: string;
	notes?: string;
}

export interface PendingByYoutuberRequest {
	action: "pending-by-youtuber";
	fromDate?: string;
	toDate?: string;
}

export interface PayoutHistoryRequest {
	action: "payout-history";
	limit?: number;
}

export interface YoutuberBankDetailsRequest {
	action: "youtuber-bank-details";
	youtuberId: string;
}

export type PayoutActionRequest =
	| MarkPaidRequest
	| PendingByYoutuberRequest
	| PayoutHistoryRequest
	| YoutuberBankDetailsRequest;

/**
 * Validates and parses the incoming request body for the admin-referral-payouts function.
 */
export function validatePayoutRequest(
	body: Record<string, unknown>,
): ValidationResult<PayoutActionRequest> {
	const { action } = body;

	if (!action || typeof action !== "string") {
		return {
			ok: false,
			error: { code: "validation_error", message: "action is required" },
		};
	}

	switch (action) {
		case "pending-by-youtuber": {
			const req: PendingByYoutuberRequest = { action: "pending-by-youtuber" };
			if (body.fromDate !== undefined) {
				if (typeof body.fromDate !== "string") {
					return {
						ok: false,
						error: {
							code: "validation_error",
							message: "fromDate must be a string",
						},
					};
				}
				req.fromDate = body.fromDate;
			}
			if (body.toDate !== undefined) {
				if (typeof body.toDate !== "string") {
					return {
						ok: false,
						error: {
							code: "validation_error",
							message: "toDate must be a string",
						},
					};
				}
				req.toDate = body.toDate;
			}
			return { ok: true, data: req };
		}

		case "mark-paid": {
			const commissionIds = body.commissionIds;
			const payoutReference = body.payoutReference;
			if (
				!Array.isArray(commissionIds) ||
				commissionIds.length === 0 ||
				!commissionIds.every((id) => typeof id === "string")
			) {
				return {
					ok: false,
					error: {
						code: "validation_error",
						message: "commissionIds must be a non-empty array of strings",
					},
				};
			}
			if (typeof payoutReference !== "string" || !payoutReference.trim()) {
				return {
					ok: false,
					error: {
						code: "validation_error",
						message: "payoutReference is required",
					},
				};
			}
			const req: MarkPaidRequest = {
				action: "mark-paid",
				commissionIds: commissionIds as string[],
				payoutReference: payoutReference.trim(),
			};
			if (body.notes !== undefined && typeof body.notes === "string") {
				req.notes = body.notes.trim();
			}
			return { ok: true, data: req };
		}

		case "payout-history": {
			const req: PayoutHistoryRequest = { action: "payout-history" };
			if (body.limit !== undefined) {
				const limit = Number(body.limit);
				if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
					return {
						ok: false,
						error: {
							code: "validation_error",
							message: "limit must be between 1 and 100",
						},
					};
				}
				req.limit = limit;
			}
			return { ok: true, data: req };
		}

		case "youtuber-bank-details": {
			if (typeof body.youtuberId !== "string" || !body.youtuberId.trim()) {
				return {
					ok: false,
					error: {
						code: "validation_error",
						message: "youtuberId is required",
					},
				};
			}
			const req: YoutuberBankDetailsRequest = {
				action: "youtuber-bank-details",
				youtuberId: body.youtuberId.trim(),
			};
			return { ok: true, data: req };
		}

		default:
			return {
				ok: false,
				error: {
					code: "validation_error",
					message: `Unknown action: ${action}`,
				},
			};
	}
}

/**
 * Groups pending commissions by YouTuber and formats the response,
 * ordered by totalPendingAmount DESC.
 */
export function buildPendingByYoutuberResponse(
	rows: PendingCommissionRow[],
): PendingByYoutuberResponse {
	const grouped = new Map<string, PendingByYoutuberGroup>();

	for (const row of rows) {
		const existing = grouped.get(row.youtuber_id);
		if (existing) {
			existing.totalPendingAmount += row.commission_amount;
			existing.commissionCount += 1;
			existing.commissions.push({
				id: row.id,
				commissionAmount: row.commission_amount,
				occurredAt: row.occurred_at,
				workshopName: row.workshop_name ?? null,
			});
		} else {
			grouped.set(row.youtuber_id, {
				youtuberId: row.youtuber_id,
				displayName: row.youtuber_name ?? "Unknown",
				totalPendingAmount: row.commission_amount,
				commissionCount: 1,
				commissions: [
					{
						id: row.id,
						commissionAmount: row.commission_amount,
						occurredAt: row.occurred_at,
						workshopName: row.workshop_name ?? null,
					},
				],
			});
		}
	}

	const youtubers = Array.from(grouped.values());
	youtubers.sort((a, b) => b.totalPendingAmount - a.totalPendingAmount);

	return { youtubers };
}

/**
 * Formats payout history response with nested commission details.
 */
export function mapPayoutHistoryRows(
	rows: unknown[],
): PayoutRunWithCommissionsRow[] {
	return rows.flatMap((row) => {
		const record = asRecord(row);
		if (!record) return [];

		const profile = asRecord(record.profiles);
		const commissions = asRecordArray(record.referral_commissions).map(
			(commission) => ({
				id: commission.id as string,
				commission_amount: Number(commission.commission_amount),
				youtuber_name:
					(asRecord(commission.youtubers)?.display_name as
						| string
						| undefined) ?? null,
				workshop_name:
					(asRecord(commission.workshops)?.name as string | undefined) ?? null,
			}),
		);

		return [
			{
				id: record.id as string,
				created_by: record.created_by as string,
				total_amount: Number(record.total_amount),
				commission_count: Number(record.commission_count),
				reference: (record.reference as string | null | undefined) ?? null,
				notes: (record.notes as string | null | undefined) ?? null,
				created_at: record.created_at as string,
				admin_email:
					(profile?.display_name as string | undefined) ??
					(record.created_by as string | undefined) ??
					null,
				commissions,
			},
		];
	});
}

export function buildPayoutHistoryResponse(
	runs: PayoutRunWithCommissionsRow[],
): PayoutHistoryResponse {
	const payoutRuns = runs.map((r) => ({
		id: r.id,
		createdAt: r.created_at,
		totalAmount: r.total_amount,
		commissionCount: r.commission_count,
		reference: r.reference ?? null,
		notes: r.notes ?? null,
		createdBy: r.admin_email ?? null,
		commissions: (r.commissions ?? []).map((c) => ({
			id: c.id,
			commissionAmount: c.commission_amount,
			youtuberName: c.youtuber_name ?? null,
			workshopName: c.workshop_name ?? null,
		})),
	}));

	return { payoutRuns };
}
