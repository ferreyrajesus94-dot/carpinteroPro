// admin-referral-payouts Edge Function
// Lists pending commissions grouped by YouTuber, marks commissions as paid (single/bulk),
// queries payout history, and retrieves YouTuber bank details.
// All endpoints use requirePlatformAdmin + serviceClient patterns.

import { requirePlatformAdmin, AdminAuthError } from "../_shared/admin-auth.ts";
import { serviceClient } from "../_shared/auth.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";
import {
	validatePayoutRequest,
	buildPendingByYoutuberResponse,
	buildPayoutHistoryResponse,
	mapPayoutHistoryRows,
	type PendingCommissionRow,
	type MarkPaidRequest,
	type PendingByYoutuberRequest,
	type PayoutHistoryRequest,
	type YoutuberBankDetailsRequest,
} from "./mapping.ts";
import { computePayoutTotal, buildPayoutRunRecord } from "./payouts.ts";

declare const Deno: {
	serve(handler: (req: Request) => Response | Promise<Response>): void;
};

Deno.serve(async (req: Request) => {
	const options = preflight(req);
	if (options) return options;
	if (req.method !== "POST") {
		return structuredErr("method_not_allowed", "Method not allowed", 405);
	}

	try {
		const admin = await requirePlatformAdmin(req);
		const body: Record<string, unknown> = await req.json().catch(() => ({}));

		const validation = validatePayoutRequest(body);
		if (!validation.ok) {
			return json(validation.error, 400);
		}

		const actionRequest = validation.data;

		switch (actionRequest.action) {
			case "pending-by-youtuber":
				return handlePendingByYoutuber(actionRequest);
			case "mark-paid":
				return handleMarkPaid(actionRequest, admin.userId);
			case "payout-history":
				return handlePayoutHistory(actionRequest);
			case "youtuber-bank-details":
				return handleYoutuberBankDetails(actionRequest);
			default:
				return structuredErr("invalid_action", "Unknown action", 400);
		}
	} catch (err) {
		if (err instanceof AdminAuthError) {
			return structuredErr("admin_auth_failed", err.message, err.status);
		}
		console.error("admin-referral-payouts: unexpected error", err);
		return structuredErr("internal_error", "Internal server error", 500);
	}
});

async function handlePendingByYoutuber(
	req: PendingByYoutuberRequest,
): Promise<Response> {
	const supabase = serviceClient();

	let query = supabase
		.from("referral_commissions")
		.select(`
      id,
      youtuber_id,
      youtubers!inner(display_name),
      commission_amount,
      occurred_at,
      workshop_id,
      workshops(name)
    `)
		.eq("status", "pending")
		.returns<PendingCommissionRow[]>();

	if (req.fromDate) {
		query = query.gte("occurred_at", req.fromDate);
	}
	if (req.toDate) {
		query = query.lte("occurred_at", req.toDate);
	}

	query = query.order("occurred_at", { ascending: false });

	const { data, error } = await query;

	if (error) {
		console.error("admin-referral-payouts: load pending failed", error);
		return structuredErr(
			"query_failed",
			"Failed to load pending commissions",
			500,
		);
	}

	const rows = (data ?? []) as unknown as PendingCommissionRow[];

	// Transform the joined data into our expected format
	const transformedRows: PendingCommissionRow[] = rows.map((row) => {
		const r = row as unknown as Record<string, unknown>;
		return {
			id: r.id as string,
			youtuber_id: r.youtuber_id as string,
			youtuber_name:
				((r.youtubers as Record<string, unknown>)?.display_name as string) ??
				null,
			commission_amount: Number(r.commission_amount),
			occurred_at: r.occurred_at as string,
			workshop_name:
				((r.workshops as Record<string, unknown>)?.name as string) ?? null,
		};
	});

	const response = buildPendingByYoutuberResponse(transformedRows);
	return json(response);
}

async function handleMarkPaid(
	req: MarkPaidRequest,
	userId: string,
): Promise<Response> {
	const supabase = serviceClient();

	// 1. Verify all commissions exist and are still pending
	const { data: commissions, error: fetchError } = await supabase
		.from("referral_commissions")
		.select("id, commission_amount, status")
		.in("id", req.commissionIds);

	if (fetchError) {
		console.error(
			"admin-referral-payouts: fetch commissions failed",
			fetchError,
		);
		return structuredErr("query_failed", "Failed to verify commissions", 500);
	}

	if (!commissions || commissions.length !== req.commissionIds.length) {
		return structuredErr(
			"commissions_not_found",
			"Some commissions were not found",
			404,
		);
	}

	// 2. Check idempotency — reject if any commission is already paid
	const alreadyPaid = commissions.filter(
		(c: { id: string; commission_amount: number; status: string }) =>
			c.status !== "pending",
	);
	if (alreadyPaid.length > 0) {
		return structuredErr(
			"commissions_already_paid",
			`${alreadyPaid.length} commission(s) are already paid or cancelled`,
			409,
		);
	}

	// 3. Compute total
	const totalAmount = computePayoutTotal(
		commissions.map(
			(c: { id: string; commission_amount: number; status: string }) => ({
				commissionAmount: Number(c.commission_amount),
			}),
		),
	);

	// 4. Create payout run
	const payoutRun = buildPayoutRunRecord({
		commissionIds: req.commissionIds,
		totalAmount,
		reference: req.payoutReference,
		notes: req.notes ?? null,
		createdBy: userId,
	});

	const { data: runResult, error: runError } = await supabase
		.from("payout_runs")
		.insert({
			id: payoutRun.id,
			created_by: payoutRun.created_by,
			total_amount: payoutRun.total_amount,
			commission_count: payoutRun.commission_count,
			reference: payoutRun.reference,
			notes: payoutRun.notes,
		})
		.select("id, total_amount, commission_count, reference, created_at")
		.single();

	if (runError) {
		console.error("admin-referral-payouts: create payout run failed", runError);
		return structuredErr("create_failed", "Failed to create payout run", 500);
	}

	// 5. Update commissions
	const now = new Date().toISOString();
	const { error: updateError } = await supabase
		.from("referral_commissions")
		.update({
			status: "paid",
			paid_at: now,
			payout_reference: req.payoutReference,
			payout_run_id: payoutRun.id,
		})
		.in("id", req.commissionIds);

	if (updateError) {
		console.error(
			"admin-referral-payouts: update commissions failed",
			updateError,
		);

		const { error: cleanupError } = await supabase
			.from("payout_runs")
			.delete()
			.eq("id", payoutRun.id);

		if (cleanupError) {
			console.error(
				"admin-referral-payouts: payout run cleanup failed",
				cleanupError,
			);
		}

		return structuredErr(
			"update_failed",
			"Failed to mark commissions as paid",
			500,
		);
	}

	return json({
		payoutRun: {
			id: runResult.id,
			totalAmount: Number(runResult.total_amount),
			commissionCount: runResult.commission_count,
			reference: runResult.reference,
			createdAt: runResult.created_at,
		},
	});
}

async function handlePayoutHistory(
	req: PayoutHistoryRequest,
): Promise<Response> {
	const supabase = serviceClient();

	const query = supabase
		.from("payout_runs")
		.select(`
      id,
      created_by,
      total_amount,
      commission_count,
      reference,
      notes,
      created_at,
      profiles!inner(display_name),
      referral_commissions!inner(
        id,
        commission_amount,
        youtuber_id,
        occurred_at,
        youtubers!inner(display_name),
        workshops!inner(name)
      )
    `)
		.order("created_at", { ascending: false });

	if (req.limit) {
		query.limit(req.limit);
	}

	const { data, error } = await query;

	if (error) {
		console.error("admin-referral-payouts: load history failed", error);
		return structuredErr("query_failed", "Failed to load payout history", 500);
	}

	const runs = mapPayoutHistoryRows(data ?? []);
	const response = buildPayoutHistoryResponse(runs);
	return json(response);
}

async function handleYoutuberBankDetails(
	req: YoutuberBankDetailsRequest,
): Promise<Response> {
	const supabase = serviceClient();

	const { data, error } = await supabase
		.from("youtubers")
		.select(`
      payout_cbu,
      payout_cvu,
      payout_alias,
      payout_bank_name,
      payout_holder_name,
      payout_holder_cuit
    `)
		.eq("id", req.youtuberId)
		.single();

	if (error) {
		console.error("admin-referral-payouts: fetch bank details failed", error);
		if (error.code === "PGRST116") {
			return structuredErr("youtuber_not_found", "YouTuber not found", 404);
		}
		return structuredErr("query_failed", "Failed to load bank details", 500);
	}

	return json({
		payoutCbu: data.payout_cbu,
		payoutCvu: data.payout_cvu,
		payoutAlias: data.payout_alias,
		payoutBankName: data.payout_bank_name,
		payoutHolderName: data.payout_holder_name,
		payoutHolderCuit: data.payout_holder_cuit,
	});
}
