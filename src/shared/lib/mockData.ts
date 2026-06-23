/**
 * Mock data for local development without Supabase.
 * Gated behind VITE_USE_LOCAL_MOCKS=true — never imported in production builds.
 *
 * All exports are `as const` safe objects + extracted types.
 */
import type { Session, User } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/database";

// ─── Users ───────────────────────────────────────────────────────────────────

const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001" as const;
const MOCK_WORKSHOP_ID = "00000000-0000-0000-0000-000000000010" as const;
const MOCK_SUBSCRIPTION_ID = "00000000-0000-0000-0000-000000000020" as const;

const MOCK_NOW = "2026-06-20T12:00:00Z";
const MOCK_FUTURE = "2026-09-20T12:00:00Z";

export const MOCK_USER: User = {
	id: MOCK_USER_ID,
	aud: "authenticated",
	role: "authenticated",
	email: "taller@demo.carpintero.pro",
	phone: "",
	app_metadata: { provider: "email" },
	user_metadata: {
		full_name: "Martín Gómez",
		workshop_name: "Carpintería El Ñandú",
		terms_accepted_at: MOCK_NOW,
		privacy_accepted_at: MOCK_NOW,
	},
	created_at: "2026-01-15T10:00:00Z",
	updated_at: "2026-06-20T10:00:00Z",
};

export const MOCK_SESSION: Session = {
	access_token: "mock_session_token_noop_base64",
	token_type: "bearer",
	expires_in: 3600,
	expires_at: Math.floor(Date.now() / 1000) + 3600,
	refresh_token: "mock_refresh_token_noop",
	user: MOCK_USER,
};

// Type-safe profile row (subset matching AuthProvider query)
export interface MockProfileRow {
	workshop_id: string | null;
	onboarded_at: string | null;
	is_platform_admin: boolean | null;
}

export const MOCK_PROFILE: MockProfileRow = {
	workshop_id: MOCK_WORKSHOP_ID,
	onboarded_at: "2026-01-15T10:30:00Z",
	is_platform_admin: false,
};

// ─── Workshop ────────────────────────────────────────────────────────────────

export const MOCK_WORKSHOP: Database["public"]["Tables"]["workshops"]["Row"] = {
	id: MOCK_WORKSHOP_ID,
	name: "Carpintería El Ñandú",
	created_at: "2026-01-10T08:00:00Z",
	is_active: true,
};

// ─── Subscription ────────────────────────────────────────────────────────────

export const MOCK_SUBSCRIPTION: Database["public"]["Tables"]["subscriptions"]["Row"] =
	{
		id: MOCK_SUBSCRIPTION_ID,
		workshop_id: MOCK_WORKSHOP_ID,
		status: "trialing",
		plan: "pro",
		provider: "mercadopago",
		trial_starts_at: "2026-06-01T00:00:00Z",
		trial_ends_at: MOCK_FUTURE,
		current_period_starts_at: null,
		current_period_ends_at: null,
		provider_subscription_id: null,
		provider_preapproval_id: null,
		provider_status: null,
		cancel_at_period_end: false,
		cancelled_at: null,
		first_period_discount_pct: null,
		referred_by_referral_code_id: null,
		created_at: "2026-06-01T00:00:00Z",
		updated_at: "2026-06-01T00:00:00Z",
	};

// ─── Clients ─────────────────────────────────────────────────────────────────

const CLIENTS_DATA = [
	{
		id: "00000000-0000-0000-0000-000000000101",
		name: "Laura Fernández",
		phone: "+54 11 5555-0101",
		email: "laura@ejemplo.com",
		source: "instagram" as const,
		notes: "Cliente recurrente. Prefiere maderas claras.",
	},
	{
		id: "00000000-0000-0000-0000-000000000102",
		name: "Ricardo Méndez",
		phone: "+54 11 5555-0102",
		email: "ricardo@ejemplo.com",
		source: "mercadolibre" as const,
		notes: null,
	},
	{
		id: "00000000-0000-0000-0000-000000000103",
		name: "Sofía Herrera",
		phone: null,
		email: "sofia@ejemplo.com",
		source: "otro" as const,
		notes: "Recomendada por un amigo.",
	},
	{
		id: "00000000-0000-0000-0000-000000000104",
		name: "Gabriel Silva",
		phone: "+54 11 5555-0104",
		email: "gabriel@ejemplo.com",
		source: "facebook" as const,
		notes: "Necesitó varias cotizaciones antes de decidir.",
	},
];

export const MOCK_CLIENTS: Database["public"]["Tables"]["clients"]["Row"][] =
	CLIENTS_DATA.map((c) => ({
		...c,
		workshop_id: MOCK_WORKSHOP_ID,
		created_at: "2026-03-01T09:00:00Z",
		updated_at: "2026-03-01T09:00:00Z",
	}));

// ─── Materials ───────────────────────────────────────────────────────────────

const MATERIALS_DATA = [
	{
		id: "00000000-0000-0000-0000-000000000201",
		name: "Placa de MDP 18mm Natural 1.83x2.60",
		category: "madera" as const,
		unit: "un" as const,
		price_per_unit: 18500,
		stock: 12,
		min_stock: 5,
		wood_subtype: "placa" as const,
	},
	{
		id: "00000000-0000-0000-0000-000000000202",
		name: "Placa de MDP 18mm Blanca 1.83x2.60",
		category: "madera" as const,
		unit: "un" as const,
		price_per_unit: 22000,
		stock: 3,
		min_stock: 5,
		wood_subtype: "placa" as const,
	},
	{
		id: "00000000-0000-0000-0000-000000000203",
		name: "Listón de Pino 2x2 2.40m",
		category: "madera" as const,
		unit: "un" as const,
		price_per_unit: 4200,
		stock: 25,
		min_stock: 10,
		wood_subtype: "liston" as const,
	},
	{
		id: "00000000-0000-0000-0000-000000000204",
		name: "Bisagra para mueble 45mm",
		category: "herraje" as const,
		unit: "un" as const,
		price_per_unit: 850,
		stock: 150,
		min_stock: 30,
		wood_subtype: null,
	},
	{
		id: "00000000-0000-0000-0000-000000000205",
		name: "Cola vinílica 1L",
		category: "adhesivo" as const,
		unit: "l" as const,
		price_per_unit: 3200,
		stock: 8,
		min_stock: 3,
		wood_subtype: null,
	},
	{
		id: "00000000-0000-0000-0000-000000000206",
		name: "Laca poliuretánica satinada 1L",
		category: "pintura" as const,
		unit: "l" as const,
		price_per_unit: 15000,
		stock: 2,
		min_stock: 4,
		wood_subtype: null,
	},
];

export const MOCK_MATERIALS: Database["public"]["Tables"]["materials"]["Row"][] =
	MATERIALS_DATA.map((m) => ({
		...m,
		workshop_id: MOCK_WORKSHOP_ID,
		notes: null,
		length_cm: null,
		width_cm: null,
		thickness_cm: null,
		volume_ml: null,
		pack_size: null,
		created_at: "2026-02-01T08:00:00Z",
		updated_at: "2026-02-01T08:00:00Z",
	}));

// ─── Furniture templates (muebles) ───────────────────────────────────────────

export const MOCK_FURNITURE_TEMPLATES: Database["public"]["Tables"]["furniture_templates"]["Row"][] =
	[
		{
			id: "00000000-0000-0000-0000-000000000401",
			workshop_id: MOCK_WORKSHOP_ID,
			name: "Mesa de comedor 1.80m",
			notes: null,
			category: "Mesas",
			tags: ["comedor", "melamina"],
			height_cm: 75,
			width_cm: 180,
			depth_cm: 90,
			photo_url: null,
			suggested_margin_pct: 35,
			params: [],
			created_at: "2026-01-10T08:00:00Z",
			updated_at: "2026-01-10T08:00:00Z",
		},
		{
			id: "00000000-0000-0000-0000-000000000402",
			workshop_id: MOCK_WORKSHOP_ID,
			name: "Estantería industrial metálica y madera",
			notes: null,
			category: "Estanterías",
			tags: ["industrial", "hierro", "melamina"],
			height_cm: 200,
			width_cm: 120,
			depth_cm: 40,
			photo_url: null,
			suggested_margin_pct: 40,
			params: [],
			created_at: "2026-02-05T08:00:00Z",
			updated_at: "2026-02-05T08:00:00Z",
		},
		{
			id: "00000000-0000-0000-0000-000000000403",
			workshop_id: MOCK_WORKSHOP_ID,
			name: "Biblioteca de pared 3 cuerpos",
			notes: null,
			category: "Bibliotecas",
			tags: ["melamina"],
			height_cm: 220,
			width_cm: 240,
			depth_cm: 35,
			photo_url: null,
			suggested_margin_pct: 35,
			params: [],
			created_at: "2026-03-15T08:00:00Z",
			updated_at: "2026-03-15T08:00:00Z",
		},
	];

// ─── Quotes ──────────────────────────────────────────────────────────────────

const CLIENT_IDS = CLIENTS_DATA.map((c) => c.id);

const QUOTES_RAW = [
	{
		id: "00000000-0000-0000-0000-000000000301",
		client_id: CLIENT_IDS[0],
		furniture_name: "Biblioteca de pared 3 cuerpos",
		recipe_cost: 125000,
		status: "aprobado" as const,
		margin_mode: "on_cost" as const,
		margin_pct: 40,
		created_at: "2026-06-01T10:00:00Z",
	},
	{
		id: "00000000-0000-0000-0000-000000000302",
		client_id: CLIENT_IDS[1],
		furniture_name: "Mesa de comedor 1.80m",
		recipe_cost: 98000,
		status: "enviado" as const,
		margin_mode: "on_cost" as const,
		margin_pct: 35,
		created_at: "2026-06-10T14:30:00Z",
	},
	{
		id: "00000000-0000-0000-0000-000000000303",
		client_id: CLIENT_IDS[2],
		furniture_name: "Placard dormitorio 2 puertas",
		recipe_cost: 210000,
		status: "presupuesto" as const,
		margin_mode: "on_price" as const,
		margin_pct: 30,
		created_at: "2026-06-15T09:00:00Z",
	},
	{
		id: "00000000-0000-0000-0000-000000000304",
		client_id: CLIENT_IDS[3],
		furniture_name: "Cocina lineal 3m con alacena",
		recipe_cost: 350000,
		status: "entregado" as const,
		margin_mode: "on_cost" as const,
		margin_pct: 42,
		created_at: "2026-05-20T11:00:00Z",
	},
	{
		id: "00000000-0000-0000-0000-000000000305",
		client_id: null,
		furniture_name: "Estantería industrial metálica y madera",
		recipe_cost: 75000,
		status: "en_produccion" as const,
		margin_mode: "on_price" as const,
		margin_pct: 38,
		created_at: "2026-06-05T16:00:00Z",
	},
	{
		id: "00000000-0000-0000-0000-000000000306",
		client_id: CLIENT_IDS[0],
		furniture_name: "Mesa ratona con entrepaño",
		recipe_cost: 45000,
		status: "cancelado" as const,
		margin_mode: "on_cost" as const,
		margin_pct: 30,
		created_at: "2026-04-10T08:00:00Z",
	},
];

const QUOTE_EXTRAS_MAP: Record<
	string,
	{ amount: number; show_in_quote: boolean }[]
> = {
	"00000000-0000-0000-0000-000000000301": [
		{ amount: 8000, show_in_quote: true },
		{ amount: 3500, show_in_quote: true },
	],
	"00000000-0000-0000-0000-000000000302": [
		{ amount: 5000, show_in_quote: true },
	],
	"00000000-0000-0000-0000-000000000303": [
		{ amount: 12000, show_in_quote: true },
		{ amount: 2200, show_in_quote: false },
	],
	"00000000-0000-0000-0000-000000000304": [
		{ amount: 15000, show_in_quote: true },
		{ amount: 6000, show_in_quote: true },
	],
	"00000000-0000-0000-0000-000000000305": [],
	"00000000-0000-0000-0000-000000000306": [],
};

function buildQuoteExtras(
	quoteId: string,
	startIdx: number,
): Database["public"]["Tables"]["quote_extras"]["Row"][] {
	const extras = QUOTE_EXTRAS_MAP[quoteId] ?? [];
	return extras.map((e, i) => ({
		id: `00000000-0000-0000-0000-00000000040${startIdx + i}`,
		workshop_id: MOCK_WORKSHOP_ID,
		quote_id: quoteId,
		description:
			i === 0 ? "Flete y montaje" : i === 1 ? "Pintura personalizada" : "Extra",
		amount: e.amount,
		show_in_quote: e.show_in_quote,
		sort_order: i,
	}));
}

export interface MockQuoteWithExtras {
	id: string;
	workshop_id: string;
	quote_number: string;
	client_id: string | null;
	furniture_template_id: string | null;
	furniture_name: string;
	recipe_cost: number;
	status: Database["public"]["Enums"]["quote_status"];
	margin_mode: Database["public"]["Enums"]["margin_mode"];
	margin_pct: number;
	notes: string | null;
	created_at: string;
	updated_at: string;
	client: Database["public"]["Tables"]["clients"]["Row"] | null;
	extras: Database["public"]["Tables"]["quote_extras"]["Row"][];
	recipe_snapshots: Database["public"]["Tables"]["quote_recipe_snapshots"]["Row"][];
	labor_snapshots: Database["public"]["Tables"]["quote_labor_snapshots"]["Row"][];
}

export const MOCK_QUOTES: MockQuoteWithExtras[] = QUOTES_RAW.map((q, idx) => {
	const clientData = q.client_id
		? (MOCK_CLIENTS.find((c) => c.id === q.client_id) ?? null)
		: null;
	return {
		...q,
		workshop_id: MOCK_WORKSHOP_ID,
		quote_number: `PR-${String(2026001 + idx)}`,
		furniture_template_id: null,
		notes: null,
		updated_at: q.created_at,
		extras: buildQuoteExtras(q.id, idx * 10 + 1),
		client: clientData,
		recipe_snapshots: [],
		labor_snapshots: [],
	};
});

// ─── Table name → mock data map ──────────────────────────────────────────────

export type MockTableName = keyof Pick<
	Database["public"]["Tables"],
	| "profiles"
	| "workshops"
	| "subscriptions"
	| "clients"
	| "materials"
	| "quotes"
	| "furniture_templates"
>;

export const MOCK_DATA_MAP: Record<
	MockTableName,
	Record<string, Record<string, unknown>>
> = {
	profiles: {
		[MOCK_USER_ID]: {
			workshop_id: MOCK_PROFILE.workshop_id,
			onboarded_at: MOCK_PROFILE.onboarded_at,
			is_platform_admin: MOCK_PROFILE.is_platform_admin,
		},
	},
	workshops: {
		[MOCK_WORKSHOP_ID]: MOCK_WORKSHOP as unknown as Record<string, unknown>,
	},
	subscriptions: {
		[MOCK_SUBSCRIPTION_ID]: MOCK_SUBSCRIPTION as unknown as Record<
			string,
			unknown
		>,
	},
	clients: Object.fromEntries(
		MOCK_CLIENTS.map((c) => [c.id, c as unknown as Record<string, unknown>]),
	),
	materials: Object.fromEntries(
		MOCK_MATERIALS.map((m) => [m.id, m as unknown as Record<string, unknown>]),
	),
	furniture_templates: Object.fromEntries(
		MOCK_FURNITURE_TEMPLATES.map((r) => [
			r.id,
			r as unknown as Record<string, unknown>,
		]),
	),
	quotes: Object.fromEntries(
		MOCK_QUOTES.map((q) => [q.id, q as unknown as Record<string, unknown>]),
	),
};

/**
 * Return records from a mock table filtered by workshop_id if applicable.
 */
export function getMockTableRecords(
	table: string,
	_eqColumn: string,
	_eqValue: string,
): Record<string, unknown>[] {
	const records = MOCK_DATA_MAP[table as MockTableName];
	if (!records) return [];

	// Most tables keyed by workshop_id; profiles keyed by user id (id)
	const values = Object.values(records);

	if (table === "profiles") {
		let results = values.filter(
			(v) =>
				(v as Record<string, unknown>).workshop_id === _eqValue ||
				_eqColumn === "id",
		);
		// Allow VITE_MOCK_ADMIN=true to elevate profile to platform admin for snapshot tests
		try {
			if (
				typeof import.meta !== "undefined" &&
				import.meta.env?.VITE_MOCK_ADMIN === "true"
			) {
				results = results.map((r) => ({ ...r, is_platform_admin: true }));
			}
		} catch {
			/* not in Vite env — ignore */
		}
		return results;
	}

	return values.filter(
		(v) => (v as Record<string, unknown>).workshop_id === _eqValue,
	);
}
