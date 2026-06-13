import { requirePlatformAdmin, AdminAuthError } from "../_shared/admin-auth.ts";
import { serviceClient } from "../_shared/auth.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";

declare const Deno: {
	serve(handler: (req: Request) => Response | Promise<Response>): void;
};

interface AdminSubscriptionsRequest {
	status?: string;
}

interface SubscriptionRow {
	id: string;
	workshop_id: string;
	status: string;
	plan: string;
	provider: string;
	provider_preapproval_id: string | null;
	provider_status: string | null;
	current_period_ends_at: string | null;
	updated_at: string;
}

interface WorkshopRow {
	id: string;
	name: string;
}

async function readBody(req: Request): Promise<AdminSubscriptionsRequest> {
	if (!req.body) return {};
	const body: unknown = await req.json().catch(() => ({}));
	if (!body || typeof body !== "object") return {};
	const record = body as Record<string, unknown>;
	return {
		status: typeof record.status === "string" ? record.status : undefined,
	};
}

function loadSubscriptions(status?: string) {
	let query = serviceClient()
		.from("subscriptions")
		.select(
			"id, workshop_id, status, plan, provider, provider_preapproval_id, provider_status, current_period_ends_at, updated_at",
		)
		.order("updated_at", { ascending: false })
		.limit(100);
	if (status) query = query.eq("status", status);
	return query.returns<SubscriptionRow[]>();
}

function loadWorkshopNames(workshopIds: string[]) {
	if (workshopIds.length === 0)
		return { data: [] as WorkshopRow[], error: null };
	return serviceClient()
		.from("workshops")
		.select("id, name")
		.in("id", workshopIds)
		.returns<WorkshopRow[]>();
}

function mapSubscriptions(
	subscriptions: SubscriptionRow[],
	workshops: WorkshopRow[],
) {
	const workshopNameById = new Map<string, string>(
		workshops.map((workshop: WorkshopRow) => [workshop.id, workshop.name]),
	);

	return subscriptions.map((subscription: SubscriptionRow) => ({
		id: subscription.id,
		workshopId: subscription.workshop_id,
		workshopName:
			workshopNameById.get(subscription.workshop_id) ?? "Taller sin nombre",
		status: subscription.status,
		plan: subscription.plan,
		provider: subscription.provider,
		providerPreapprovalId: subscription.provider_preapproval_id,
		providerStatus: subscription.provider_status,
		currentPeriodEnd: subscription.current_period_ends_at,
		updatedAt: subscription.updated_at,
	}));
}

async function handleAuthorizedRequest(status?: string): Promise<Response> {
	const { data: subscriptions, error } = await loadSubscriptions(status);
	if (error) {
		console.error("admin-subscriptions: subscriptions lookup failed", error);
		return structuredErr(
			"admin_subscriptions_lookup_failed",
			"No se pudieron cargar las suscripciones",
			500,
		);
	}

	const subscriptionRows: SubscriptionRow[] = subscriptions ?? [];
	const workshopIds = Array.from(
		new Set(
			subscriptionRows.map(
				(subscription: SubscriptionRow) => subscription.workshop_id,
			),
		),
	);
	const { data: workshops, error: workshopsError } =
		await loadWorkshopNames(workshopIds);
	if (workshopsError) {
		console.error(
			"admin-subscriptions: workshops lookup failed",
			workshopsError,
		);
		return structuredErr(
			"admin_subscriptions_workshops_lookup_failed",
			"No se pudo cargar el contexto de talleres",
			500,
		);
	}

	return json({
		subscriptions: mapSubscriptions(subscriptionRows, workshops ?? []),
	});
}

async function handleRequest(req: Request): Promise<Response> {
	const options = preflight(req);
	if (options) return options;
	if (req.method !== "POST") {
		return structuredErr("method_not_allowed", "Method not allowed", 405);
	}

	try {
		await requirePlatformAdmin(req);
		const { status } = await readBody(req);
		return await handleAuthorizedRequest(status);
	} catch (e: unknown) {
		if (e instanceof AdminAuthError) {
			return structuredErr("admin_auth_failed", e.message, e.status);
		}
		return structuredErr(
			"admin_subscriptions_failed",
			"No se pudieron cargar las suscripciones",
			500,
		);
	}
}

Deno.serve(handleRequest);
