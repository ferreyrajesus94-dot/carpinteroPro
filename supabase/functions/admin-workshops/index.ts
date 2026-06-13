import { requirePlatformAdmin, AdminAuthError } from "../_shared/admin-auth.ts";
import { serviceClient } from "../_shared/auth.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";

declare const Deno: {
	serve(handler: (req: Request) => Response | Promise<Response>): void;
	env: { get(key: string): string | undefined };
};

interface AdminWorkshopsRequest {
	search?: string;
	workshopId?: string;
}

interface WorkshopRow {
	id: string;
	name: string;
	created_at: string;
	is_active: boolean;
}

interface ProfileRow {
	id: string;
	workshop_id: string;
	onboarded_at: string | null;
}

interface UserRow {
	id: string;
	email: string;
}

interface SubscriptionRow {
	workshop_id: string;
	status: string;
}

interface RelatedRows {
	profiles: ProfileRow[];
	subscriptions: SubscriptionRow[];
	ownerEmailById: Map<string, string>;
}

async function readBody(req: Request): Promise<AdminWorkshopsRequest> {
	if (!req.body) return {};
	const body: unknown = await req.json().catch(() => ({}));
	if (!body || typeof body !== "object") return {};
	const record = body as Record<string, unknown>;
	return {
		search:
			typeof record.search === "string" ? record.search.trim() : undefined,
		workshopId:
			typeof record.workshopId === "string" ? record.workshopId : undefined,
	};
}

function loadWorkshops(body: AdminWorkshopsRequest) {
	let query = serviceClient()
		.from("workshops")
		.select("id, name, created_at, is_active")
		.order("created_at", { ascending: false })
		.limit(100);

	if (body.workshopId) query = query.eq("id", body.workshopId);
	if (!body.workshopId && body.search)
		query = query.ilike("name", `%${body.search}%`);

	return query.returns<WorkshopRow[]>();
}

async function loadRelatedRows(
	workshopIds: string[],
): Promise<RelatedRows | Response> {
	const supabase = serviceClient();
	const [profilesResult, subscriptionsResult] = await Promise.all([
		supabase
			.from("profiles")
			.select("id, workshop_id, onboarded_at")
			.in("workshop_id", workshopIds)
			.returns<ProfileRow[]>(),
		supabase
			.from("subscriptions")
			.select("workshop_id, status")
			.in("workshop_id", workshopIds)
			.returns<SubscriptionRow[]>(),
	]);

	if (profilesResult.error || subscriptionsResult.error) {
		console.error("admin-workshops: related lookup failed", {
			profilesError: profilesResult.error,
			subscriptionsError: subscriptionsResult.error,
		});
		return structuredErr(
			"admin_workshops_related_lookup_failed",
			"No se pudo cargar el contexto de talleres",
			500,
		);
	}

	// Determine owner for each workshop: profile with earliest onboarded_at
	const ownerIds = new Set<string>();
	const profiles = profilesResult.data ?? [];
	for (const p of profiles) {
		if (p.onboarded_at !== null) ownerIds.add(p.id);
	}

	// Fetch emails for owner profiles via GoTrue admin API
	const ownerEmailById = new Map<string, string>();
	if (ownerIds.size > 0) {
		const authUrl = `${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users`;
		const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
		try {
			const res = await fetch(authUrl, {
				headers: {
					Authorization: `Bearer ${serviceKey}`,
					apikey: serviceKey,
				},
			});
			if (res.ok) {
				const data = (await res.json()) as { users: UserRow[] };
				for (const u of data.users ?? []) {
					if (ownerIds.has(u.id)) {
						ownerEmailById.set(u.id, u.email);
					}
				}
			}
		} catch {
			// Fall through — owner emails stay as empty map, DTO shows null
		}
	}

	return {
		profiles,
		subscriptions: subscriptionsResult.data ?? [],
		ownerEmailById,
	};
}

function mapWorkshop(workshop: WorkshopRow, related: RelatedRows) {
	const workshopProfiles = related.profiles.filter(
		(profile: ProfileRow) => profile.workshop_id === workshop.id,
	);
	const subscription = related.subscriptions.find(
		(row: SubscriptionRow) => row.workshop_id === workshop.id,
	);

	// Owner is the first onboarded profile (earliest onboarded_at)
	const onboardedProfiles = workshopProfiles
		.filter((p) => p.onboarded_at !== null)
		.sort(
			(a, b) =>
				new Date(a.onboarded_at!).getTime() -
				new Date(b.onboarded_at!).getTime(),
		);
	const ownerProfile = onboardedProfiles[0];
	const ownerEmail = ownerProfile
		? (related.ownerEmailById.get(ownerProfile.id) ?? null)
		: null;

	return {
		id: workshop.id,
		name: workshop.name,
		createdAt: workshop.created_at,
		isActive: workshop.is_active,
		ownerEmail,
		profileCount: workshopProfiles.length,
		onboardedProfileCount: onboardedProfiles.length,
		subscriptionStatus: subscription?.status ?? null,
	};
}

async function handleAuthorizedRequest(
	body: AdminWorkshopsRequest,
): Promise<Response> {
	const { data: workshops, error } = await loadWorkshops(body);
	if (error) {
		console.error("admin-workshops: workshops lookup failed", error);
		return structuredErr(
			"admin_workshops_lookup_failed",
			"No se pudieron cargar los talleres",
			500,
		);
	}
	if (body.workshopId && (!workshops || workshops.length === 0)) {
		return structuredErr("workshop_not_found", "Taller no encontrado", 404);
	}

	const workshopRows: WorkshopRow[] = workshops ?? [];
	const workshopIds = workshopRows.map((workshop: WorkshopRow) => workshop.id);
	if (workshopIds.length === 0) return json({ workshops: [] });

	const related = await loadRelatedRows(workshopIds);
	if (related instanceof Response) return related;
	const payload = workshopRows.map((workshop: WorkshopRow) =>
		mapWorkshop(workshop, related),
	);
	return json(
		body.workshopId ? { workshop: payload[0] } : { workshops: payload },
	);
}

async function handleRequest(req: Request): Promise<Response> {
	const options = preflight(req);
	if (options) return options;
	if (req.method !== "POST") {
		return structuredErr("method_not_allowed", "Method not allowed", 405);
	}

	try {
		await requirePlatformAdmin(req);
		return await handleAuthorizedRequest(await readBody(req));
	} catch (e: unknown) {
		if (e instanceof AdminAuthError) {
			return structuredErr("admin_auth_failed", e.message, e.status);
		}
		return structuredErr(
			"admin_workshops_failed",
			"No se pudieron cargar los talleres",
			500,
		);
	}
}

Deno.serve(handleRequest);
