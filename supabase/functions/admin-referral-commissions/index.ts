import { requirePlatformAdmin, AdminAuthError } from "../_shared/admin-auth.ts";
import { serviceClient } from "../_shared/auth.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";
import {
	validateCommissionsRequest,
	buildCommissionCsv,
	buildCommissionJsonResponse,
	type CommissionFilters,
	type CommissionRow,
} from "./mapping.ts";

declare const Deno: {
	serve(handler: (req: Request) => Response | Promise<Response>): void;
	env: {
		get(key: string): string | undefined;
	};
};

interface CommissionDbRow {
	id: string;
	workshop_id: string;
	youtuber_id: string;
	referral_code_id: string;
	subscription_id: string | null;
	provider_payment_id: string;
	payment_amount: number;
	commission_pct: number;
	commission_amount: number;
	currency: string;
	status: string;
	occurred_at: string;
}

interface YoutuberRow {
	id: string;
	display_name: string;
}

interface ReferralCodeRow {
	id: string;
	code: string;
	youtuber_id: string;
}

interface WorkshopRow {
	id: string;
	name: string;
}

async function loadCommissions(
	filters: CommissionFilters,
): Promise<CommissionRow[]> {
	const supabase = serviceClient();

	// The joined approach via single query
	const query = supabase
		.from("referral_commissions")
		.select("*")
		.order("occurred_at", { ascending: false })
		.returns<CommissionDbRow[]>();

	if (filters.youtuberId) {
		query.eq("youtuber_id", filters.youtuberId);
	}
	if (filters.fromDate) {
		query.gte("occurred_at", filters.fromDate);
	}
	if (filters.toDate) {
		query.lte("occurred_at", filters.toDate);
	}
	if (filters.limit) {
		query.limit(filters.limit);
	}

	const { data: commissions, error } = await query;
	if (error) {
		console.error("admin-referral-commissions: load failed", error);
		return [];
	}

	const commissionRows = (commissions ?? []) as CommissionDbRow[];

	if (commissionRows.length === 0) {
		return [];
	}

	// Fetch related data for all commissions
	const youtuberIds = [...new Set(commissionRows.map((c) => c.youtuber_id))];
	const codeIds = [...new Set(commissionRows.map((c) => c.referral_code_id))];
	const workshopIds = [...new Set(commissionRows.map((c) => c.workshop_id))];

	const [youtubersResult, codesResult, workshopsResult] = await Promise.all([
		supabase
			.from("youtubers")
			.select("id, display_name")
			.in("id", youtuberIds)
			.returns<YoutuberRow[]>(),
		supabase
			.from("referral_codes")
			.select("id, code, youtuber_id")
			.in("id", codeIds)
			.returns<ReferralCodeRow[]>(),
		supabase
			.from("workshops")
			.select("id, name")
			.in("id", workshopIds)
			.returns<WorkshopRow[]>(),
	]);

	const youtubers = youtubersResult.data ?? [];
	const codes = codesResult.data ?? [];
	const workshops = workshopsResult.data ?? [];

	const youtuberMap = new Map<string, string>(
		youtubers.map((y: YoutuberRow) => [y.id, y.display_name]),
	);
	const codeMap = new Map<string, string>(
		codes.map((c: ReferralCodeRow) => [c.id, c.code]),
	);
	const workshopMap = new Map<string, string>(
		workshops.map((w: WorkshopRow) => [w.id, w.name]),
	);

	return commissionRows.map((c) => ({
		id: c.id,
		workshopId: c.workshop_id,
		youtuberId: c.youtuber_id,
		referralCodeId: c.referral_code_id,
		subscriptionId: c.subscription_id,
		providerPaymentId: c.provider_payment_id,
		paymentAmount: c.payment_amount,
		commissionPct: c.commission_pct,
		commissionAmount: c.commission_amount,
		currency: c.currency,
		status: c.status,
		occurredAt: c.occurred_at,
		youtuberName: youtuberMap.get(c.youtuber_id) ?? null,
		code: codeMap.get(c.referral_code_id) ?? null,
		workshopName: workshopMap.get(c.workshop_id) ?? null,
	}));
}

function buildFilename(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `referral-commissions-${y}-${m}-${d}.csv`;
}

Deno.serve(async (req: Request) => {
	const options = preflight(req);
	if (options) return options;
	if (req.method !== "POST") {
		return structuredErr("method_not_allowed", "Method not allowed", 405);
	}

	try {
		await requirePlatformAdmin(req);

		const body: Record<string, unknown> = await req.json().catch(() => ({}));
		const validation = validateCommissionsRequest(body);
		if (!validation.ok) {
			return json(validation.error, 400);
		}

		const filters = validation.data;
		const commissions = await loadCommissions(filters);

		if (filters.format === "csv") {
			const csv = buildCommissionCsv(commissions);
			return new Response(csv, {
				status: 200,
				headers: {
					"Content-Type": "text/csv; charset=utf-8",
					"Content-Disposition": `attachment; filename="${buildFilename()}"`,
					"Access-Control-Allow-Origin":
						Deno.env.get("APP_ORIGIN") || "http://localhost:3000",
				},
			});
		}

		return json(buildCommissionJsonResponse(commissions));
	} catch (e: unknown) {
		if (e instanceof AdminAuthError) {
			return structuredErr("admin_auth_failed", e.message, e.status);
		}
		console.error("admin-referral-commissions failed", e);
		return structuredErr(
			"commissions_failed",
			"Error al cargar comisiones",
			500,
		);
	}
});
