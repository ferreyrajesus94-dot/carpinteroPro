import { requirePlatformAdmin, AdminAuthError } from "../_shared/admin-auth.ts";
import { serviceClient } from "../_shared/auth.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";

declare const Deno: {
	serve(handler: (req: Request) => Response | Promise<Response>): void;
};

interface WorkshopRow {
	created_at: string;
}

interface SubscriptionRow {
	status: string;
}

interface WebhookEventRow {
	event_type: string;
}

interface OverviewRows {
	workshops: WorkshopRow[];
	subscriptions: SubscriptionRow[];
	webhookEvents: WebhookEventRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function loadOverviewRows(): Promise<OverviewRows | Response> {
	const supabase = serviceClient();
	const [workshopsResult, subscriptionsResult, webhookResult] =
		await Promise.all([
			supabase.from("workshops").select("created_at").returns<WorkshopRow[]>(),
			supabase
				.from("subscriptions")
				.select("status")
				.returns<SubscriptionRow[]>(),
			supabase
				.from("billing_webhook_events")
				.select("event_type")
				.order("processed_at", { ascending: false })
				.limit(100)
				.returns<WebhookEventRow[]>(),
		]);

	if (
		workshopsResult.error ||
		subscriptionsResult.error ||
		webhookResult.error
	) {
		console.error("admin-overview lookup failed", {
			workshopsError: workshopsResult.error,
			subscriptionsError: subscriptionsResult.error,
			webhookError: webhookResult.error,
		});
		return structuredErr(
			"admin_overview_lookup_failed",
			"No se pudo cargar el resumen administrativo",
			500,
		);
	}

	return {
		workshops: workshopsResult.data ?? [],
		subscriptions: subscriptionsResult.data ?? [],
		webhookEvents: webhookResult.data ?? [],
	};
}

function mapOverview(rows: OverviewRows) {
	const thirtyDaysAgo = Date.now() - 30 * DAY_MS;
	const createdLast30Days = rows.workshops.filter((workshop: WorkshopRow) => {
		return new Date(workshop.created_at).getTime() >= thirtyDaysAgo;
	}).length;
	const byStatus = rows.subscriptions.reduce<Record<string, number>>(
		(acc: Record<string, number>, subscription: SubscriptionRow) => {
			acc[subscription.status] = (acc[subscription.status] ?? 0) + 1;
			return acc;
		},
		{},
	);
	const recentWebhookFailures = rows.webhookEvents.filter(
		(event: WebhookEventRow) => event.event_type.toLowerCase().includes("fail"),
	).length;

	return {
		workshops: {
			total: rows.workshops.length,
			createdLast30Days,
		},
		subscriptions: {
			total: rows.subscriptions.length,
			byStatus,
		},
		support: {
			recentWebhookFailures,
		},
	};
}

async function handleRequest(req: Request): Promise<Response> {
	const options = preflight(req);
	if (options) return options;
	if (req.method !== "POST") {
		return structuredErr("method_not_allowed", "Method not allowed", 405);
	}

	try {
		await requirePlatformAdmin(req);
		const rows = await loadOverviewRows();
		return rows instanceof Response ? rows : json(mapOverview(rows));
	} catch (e: unknown) {
		if (e instanceof AdminAuthError) {
			return structuredErr("admin_auth_failed", e.message, e.status);
		}
		return structuredErr(
			"admin_overview_failed",
			"No se pudo cargar el resumen administrativo",
			500,
		);
	}
}

Deno.serve(handleRequest);
