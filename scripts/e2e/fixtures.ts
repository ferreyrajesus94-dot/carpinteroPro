import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../src/shared/types/database";

type TestClient = SupabaseClient<Database>;
type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
type SubscriptionStatus = SubscriptionRow["status"];
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
type QuoteWithRelations = QuoteRow & {
	client: Database["public"]["Tables"]["clients"]["Row"] | null;
	extras: Database["public"]["Tables"]["quote_extras"]["Row"][];
	recipe_snapshots: Database["public"]["Tables"]["quote_recipe_snapshots"]["Row"][];
	labor_snapshots: Database["public"]["Tables"]["quote_labor_snapshots"]["Row"][];
};
type StockMovementRow = Database["public"]["Tables"]["stock_movements"]["Row"];
type StockMovementReason = Database["public"]["Enums"]["stock_movement_reason"];
type WebhookEventRow =
	Database["public"]["Tables"]["billing_webhook_events"]["Row"];

const workshopId = "00000000-0000-4000-8000-000000070001";
const fallbackSubscriptionId = "00000000-0000-4000-8000-000000070002";
const secondWorkshopId = "00000000-0000-4000-8000-000000070003";
const secondSubscriptionId = "00000000-0000-4000-8000-000000070004";
const materialAId = "00000000-0000-4000-8000-000000070005";
const materialBId = "00000000-0000-4000-8000-000000070006";
const quoteClientId = "00000000-0000-4000-8000-000000070007";
const quoteTemplateId = "00000000-0000-4000-8000-000000070008";
const quoteRecipeItemId = "00000000-0000-4000-8000-000000070009";
const quoteLaborItemId = "00000000-0000-4000-8000-00000007000a";
const quoteId = "00000000-0000-4000-8000-00000007000b";
const contractTemplateId = "00000000-0000-4000-8000-00000007000c";
const email = "e2e_sdd7_active_trial@example.invalid";
const secondEmail = "e2e_sdd7_user_b@example.invalid";
const workshopName = "e2e_sdd7_active_trial_workshop";
const secondWorkshopName = "e2e_sdd7_workshop_b";

interface FixtureUser {
	email: string;
	password: string;
	workshopName: string;
}

export function getActiveTrialUser() {
	return getFixtureUser(email, workshopName);
}

export function getSecondWorkshopUser() {
	return getFixtureUser(secondEmail, secondWorkshopName);
}

export interface ActiveTrialFixture {
	workshopId: string;
	subscriptionId: string;
	userId: string;
}

export interface MaterialFixture {
	workshopAId: string;
	workshopBId: string;
	materialA: MaterialRow;
	materialB: MaterialRow;
}

export interface QuoteWorkflowFixture extends ActiveTrialFixture {
	clientId: string;
	materialId: string;
	templateId: string;
	expectedRecipeCost: number;
	expectedSalePrice: number;
	quoteId: string;
	quoteNumber: string;
}

export interface StockMovementFixture extends MaterialFixture {
	initialStock: number;
}

export interface StockMovementOptions {
	materialId: string;
	delta: number;
	reason: StockMovementReason;
	note?: string | null;
	quoteId?: string | null;
}

export interface WebhookSimulationCommission {
	providerPaymentId: string;
	paymentAmount: number;
	currency: string;
	occurredAt: string;
}

export interface WebhookSimulationOptions {
	providerEventId: string;
	eventType: string;
	providerResourceId: string;
	providerStatus: string;
	resourceKind?: "preapproval" | "payment" | "authorized_payment";
	providerPreapprovalId?: string;
	providerSnapshotAt?: string | null;
	providerFetchedAt?: string;
	commission?: WebhookSimulationCommission;
	payload?: Json;
}

export interface SeedOptions {
	trialEndsAt?: Date;
	status?: SubscriptionStatus;
	workshopId?: string;
	subscriptionId?: string;
	userEmail?: string;
	workshopName?: string;
	displayName?: string;
	providerPreapprovalId?: string;
}

function getFixtureUser(
	userEmail: string,
	userWorkshopName: string,
): FixtureUser {
	return {
		email: userEmail,
		password: readRequiredEnv("E2E_TEST_PASSWORD"),
		workshopName: userWorkshopName,
	};
}

function readRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing ${name} for SDD 7 E2E fixtures`);
	return value;
}

function supabaseUrl() {
	return readRequiredEnv("E2E_SUPABASE_URL");
}

function adminClient(): TestClient {
	return createClient<Database>(
		supabaseUrl(),
		readRequiredEnv("E2E_SUPABASE_SERVICE_ROLE_KEY"),
		{ auth: { persistSession: false, autoRefreshToken: false } },
	);
}

function anonClient(): TestClient {
	return createClient<Database>(
		supabaseUrl(),
		readRequiredEnv("E2E_SUPABASE_ANON_KEY"),
		{ auth: { persistSession: false, autoRefreshToken: false } },
	);
}

async function findUserIdByEmail(
	client: TestClient,
	userEmail: string,
): Promise<string | null> {
	let page = 1;
	while (true) {
		const { data, error } = await client.auth.admin.listUsers({
			page,
			perPage: 100,
		});
		if (error) throw error;
		const found = data.users.find((user) => user.email === userEmail);
		if (found) return found.id;
		if (data.users.length < 100) return null;
		page += 1;
	}
}

async function ensureUser(client: TestClient, fixtureUser: FixtureUser) {
	const existingId = await findUserIdByEmail(client, fixtureUser.email);
	if (existingId) {
		const { error } = await client.auth.admin.updateUserById(existingId, {
			password: fixtureUser.password,
			email_confirm: true,
			user_metadata: { workshop_name: fixtureUser.workshopName },
		});
		if (error) throw error;
		return existingId;
	}
	const { data, error } = await client.auth.admin.createUser({
		email: fixtureUser.email,
		password: fixtureUser.password,
		email_confirm: true,
		user_metadata: { workshop_name: fixtureUser.workshopName },
	});
	if (error) throw error;
	return data.user.id;
}

export async function cleanupSdd7Fixtures(): Promise<void> {
	const client = adminClient();
	const userIds = (
		await Promise.all([
			findUserIdByEmail(client, email),
			findUserIdByEmail(client, secondEmail),
		])
	).filter((id): id is string => Boolean(id));

	const { data: workshops, error: workshopError } = await client
		.from("workshops")
		.select("id")
		.ilike("name", "e2e_sdd7_%");
	if (workshopError) throw workshopError;
	const workshopIds = [
		workshopId,
		secondWorkshopId,
		...(workshops ?? []).map((workshop) => workshop.id),
	].filter((id, index, ids) => ids.indexOf(id) === index);

	if (workshopIds.length > 0) {
		const { error: webhookEventError } = await client
			.from("billing_webhook_events")
			.delete()
			.in("workshop_id", workshopIds);
		if (webhookEventError) throw webhookEventError;

		const quoteTables = [
			"quote_extras",
			"quote_recipe_snapshots",
			"quote_labor_snapshots",
			"stock_movements",
			"quotes",
		] as const;
		for (const table of quoteTables) {
			const { error } = await client
				.from(table)
				.delete()
				.in("workshop_id", workshopIds);
			if (error) throw error;
		}

		const recipeTables = [
			"recipe_items",
			"labor_items",
			"contract_templates",
			"furniture_templates",
			"clients",
		] as const;
		for (const table of recipeTables) {
			const { error } = await client
				.from(table)
				.delete()
				.in("workshop_id", workshopIds);
			if (error) throw error;
		}

		const { error: materialError } = await client
			.from("materials")
			.delete()
			.in("workshop_id", workshopIds);
		if (materialError) throw materialError;

		const { error: subscriptionError } = await client
			.from("subscriptions")
			.delete()
			.in("workshop_id", workshopIds);
		if (subscriptionError) throw subscriptionError;
	}
	if (userIds.length > 0) {
		const { error: profileError } = await client
			.from("profiles")
			.delete()
			.in("id", userIds);
		if (profileError) throw profileError;
	}
	if (workshopIds.length > 0) {
		const { error: finalWorkshopError } = await client
			.from("workshops")
			.delete()
			.in("id", workshopIds);
		if (finalWorkshopError) throw finalWorkshopError;
	}
	for (const userId of userIds) {
		const { error } = await client.auth.admin.deleteUser(userId);
		if (error) throw error;
	}
}

export async function seedActiveTrialFixture(
	options: SeedOptions = {},
): Promise<ActiveTrialFixture> {
	const client = adminClient();
	const now = new Date();
	const fixtureWorkshopId = options.workshopId ?? workshopId;
	const fixtureSubscriptionId =
		options.subscriptionId ?? fallbackSubscriptionId;
	const fixtureEmail = options.userEmail ?? email;
	const fixtureWorkshopName = options.workshopName ?? workshopName;
	const trialEndsAt =
		options.trialEndsAt ?? new Date(now.getTime() + 7 * 86_400_000);
	const status = options.status ?? "trialing";
	const fixtureUser = getFixtureUser(fixtureEmail, fixtureWorkshopName);
	const userId = await ensureUser(client, fixtureUser);

	const { error: workshopError } = await client
		.from("workshops")
		.upsert({ id: fixtureWorkshopId, name: fixtureWorkshopName });
	if (workshopError) throw workshopError;

	const { error: profileError } = await client.from("profiles").upsert({
		id: userId,
		workshop_id: fixtureWorkshopId,
		display_name: options.displayName ?? "SDD 7 Active Trial",
		onboarded_at: now.toISOString(),
		terms_accepted_at: now.toISOString(),
		privacy_accepted_at: now.toISOString(),
	});
	if (profileError) throw profileError;

	const subscriptionValues = {
		workshop_id: fixtureWorkshopId,
		status,
		plan: "starter" as const,
		provider: "mercadopago" as const,
		trial_starts_at: now.toISOString(),
		trial_ends_at: trialEndsAt.toISOString(),
		current_period_starts_at: status === "active" ? now.toISOString() : null,
		current_period_ends_at:
			status === "active"
				? new Date(now.getTime() + 30 * 86_400_000).toISOString()
				: null,
		provider_subscription_id: `e2e_sdd7_subscription_${fixtureWorkshopId}`,
		provider_preapproval_id:
			options.providerPreapprovalId ??
			`e2e_sdd7_preapproval_${fixtureWorkshopId}`,
		provider_status: status === "active" ? "authorized" : status,
		cancel_at_period_end: false,
		cancelled_at: null,
		updated_at: now.toISOString(),
	};
	const { data: existingSubscription, error: existingSubscriptionError } =
		await client
			.from("subscriptions")
			.select("id")
			.eq("workshop_id", fixtureWorkshopId)
			.maybeSingle();
	if (existingSubscriptionError) throw existingSubscriptionError;

	const subscriptionWrite = existingSubscription
		? await client
				.from("subscriptions")
				.update(subscriptionValues)
				.eq("workshop_id", fixtureWorkshopId)
				.select("id")
				.single()
		: await client
				.from("subscriptions")
				.insert({ id: fixtureSubscriptionId, ...subscriptionValues })
				.select("id")
				.single();
	if (subscriptionWrite.error) throw subscriptionWrite.error;

	return {
		workshopId: fixtureWorkshopId,
		subscriptionId: subscriptionWrite.data.id,
		userId,
	};
}

export async function seedSecondWorkshopFixture() {
	return seedActiveTrialFixture({
		workshopId: secondWorkshopId,
		subscriptionId: secondSubscriptionId,
		userEmail: secondEmail,
		workshopName: secondWorkshopName,
		displayName: "SDD 7 Tenant B",
		providerPreapprovalId: "e2e_sdd7_preapproval_b",
	});
}

export async function seedMaterialIsolationFixtures(): Promise<MaterialFixture> {
	const firstFixture = await seedActiveTrialFixture();
	const secondFixture = await seedSecondWorkshopFixture();
	const client = adminClient();
	const { data: materialA, error: materialAError } = await client
		.from("materials")
		.upsert({
			id: materialAId,
			workshop_id: firstFixture.workshopId,
			name: "e2e_sdd7_material_a",
			category: "madera",
			unit: "m2",
			price_per_unit: 100,
			stock: 10,
			min_stock: 1,
		})
		.select("*")
		.single();
	if (materialAError) throw materialAError;
	const { data: materialB, error: materialBError } = await client
		.from("materials")
		.upsert({
			id: materialBId,
			workshop_id: secondFixture.workshopId,
			name: "e2e_sdd7_material_b",
			category: "madera",
			unit: "m2",
			price_per_unit: 200,
			stock: 20,
			min_stock: 2,
		})
		.select("*")
		.single();
	if (materialBError) throw materialBError;

	return {
		workshopAId: firstFixture.workshopId,
		workshopBId: secondFixture.workshopId,
		materialA,
		materialB,
	};
}

export async function seedQuoteWorkflowFixture(): Promise<QuoteWorkflowFixture> {
	const fixture = await seedActiveTrialFixture();
	const client = adminClient();
	const now = new Date().toISOString();

	const { error: clientError } = await client.from("clients").upsert({
		id: quoteClientId,
		workshop_id: fixture.workshopId,
		name: "SDD 7 Cliente Presupuesto",
		phone: "+541112345678",
		email: "cliente.sdd7@example.invalid",
		source: "otro",
	});
	if (clientError) throw clientError;

	const { data: material, error: materialError } = await client
		.from("materials")
		.upsert({
			id: materialAId,
			workshop_id: fixture.workshopId,
			name: "e2e_sdd7_material_quote",
			category: "herraje",
			unit: "un",
			price_per_unit: 100,
			stock: 10,
			min_stock: 1,
		})
		.select("*")
		.single();
	if (materialError) throw materialError;

	const { error: templateError } = await client
		.from("furniture_templates")
		.upsert({
			id: quoteTemplateId,
			workshop_id: fixture.workshopId,
			name: "SDD 7 Mesa Operativa",
			category: "mesa",
			tags: ["e2e_sdd7"],
			suggested_margin_pct: 30,
			params: [],
		});
	if (templateError) throw templateError;

	const { error: recipeError } = await client.from("recipe_items").upsert({
		id: quoteRecipeItemId,
		workshop_id: fixture.workshopId,
		furniture_template_id: quoteTemplateId,
		material_id: material.id,
		quantity: 2,
		waste_pct: 10,
	});
	if (recipeError) throw recipeError;

	const { error: laborError } = await client.from("labor_items").upsert({
		id: quoteLaborItemId,
		workshop_id: fixture.workshopId,
		furniture_template_id: quoteTemplateId,
		description: "Armado E2E",
		hours: 3,
		rate: 50,
	});
	if (laborError) throw laborError;

	const { error: contractTemplateError } = await client
		.from("contract_templates")
		.upsert({
			id: contractTemplateId,
			workshop_id: fixture.workshopId,
			name: "Contrato SDD 7",
			body_markdown:
				"Contrato para **{{client_name}}** por {{furniture_name}}. Total: **{{total}}**.",
			is_default: true,
			updated_at: now,
		});
	if (contractTemplateError) throw contractTemplateError;

	return {
		...fixture,
		clientId: quoteClientId,
		materialId: material.id,
		templateId: quoteTemplateId,
		expectedRecipeCost: 370,
		expectedSalePrice: 481,
		quoteId,
		quoteNumber: "P-0001",
	};
}

export async function seedContractQuoteFixture(): Promise<QuoteWorkflowFixture> {
	const fixture = await seedQuoteWorkflowFixture();
	const client = adminClient();
	const { error: quoteError } = await client.from("quotes").upsert({
		id: quoteId,
		workshop_id: fixture.workshopId,
		quote_number: fixture.quoteNumber,
		client_id: fixture.clientId,
		furniture_template_id: fixture.templateId,
		furniture_name: "SDD 7 Mesa Operativa",
		recipe_cost: fixture.expectedRecipeCost,
		status: "presupuesto",
		margin_mode: "on_cost",
		margin_pct: 30,
	});
	if (quoteError) throw quoteError;
	return fixture;
}

export async function fetchFixtureQuoteByFurnitureName(
	furnitureName: string,
): Promise<QuoteWithRelations | null> {
	const { data, error } = await adminClient()
		.from("quotes")
		.select(
			"*, client:clients (*), extras:quote_extras (*), recipe_snapshots:quote_recipe_snapshots (*), labor_snapshots:quote_labor_snapshots (*)",
		)
		.eq("furniture_name", furnitureName)
		.maybeSingle();
	if (error) throw error;
	return data as QuoteWithRelations | null;
}

export async function seedStockMovementFixture(): Promise<StockMovementFixture> {
	const fixture = await seedMaterialIsolationFixtures();
	return { ...fixture, initialStock: fixture.materialA.stock };
}

export async function applyFixtureStockMovement(
	client: TestClient,
	options: StockMovementOptions,
): Promise<number> {
	const { data, error } = await client.rpc("apply_stock_movement", {
		p_material_id: options.materialId,
		p_delta: options.delta,
		p_reason: options.reason,
		p_note: options.note ?? null,
		p_quote_id: options.quoteId ?? null,
	});
	if (error) throw error;
	return data as number;
}

export async function fetchFixtureMaterial(
	client: TestClient,
	materialId: string,
): Promise<MaterialRow | null> {
	const { data, error } = await client
		.from("materials")
		.select("*")
		.eq("id", materialId)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function fetchFixtureStockMovements(
	client: TestClient,
	materialId: string,
): Promise<StockMovementRow[]> {
	const { data, error } = await client
		.from("stock_movements")
		.select("*")
		.eq("material_id", materialId)
		.order("created_at", { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function createAuthenticatedFixtureClient(): Promise<TestClient> {
	return createAuthenticatedClient(getActiveTrialUser());
}

export async function createAuthenticatedFixtureClientB(): Promise<TestClient> {
	return createAuthenticatedClient(getSecondWorkshopUser());
}

async function createAuthenticatedClient(
	user: FixtureUser,
): Promise<TestClient> {
	const client = anonClient();
	const { error } = await client.auth.signInWithPassword({
		email: user.email,
		password: user.password,
	});
	if (error) throw error;
	return client;
}

export async function fetchFixtureSubscription(
	client: TestClient,
	fixtureWorkshopId: string,
): Promise<SubscriptionRow | null> {
	const { data, error } = await client
		.from("subscriptions")
		.select("*")
		.eq("workshop_id", fixtureWorkshopId)
		.single();
	if (error) throw error;
	return data as SubscriptionRow;
}

export async function mutateFixtureSubscriptionStatus(
	status: SubscriptionStatus,
): Promise<void> {
	await mutateFixtureSubscription(workshopId, { status });
}

export async function mutateFixtureSubscription(
	fixtureWorkshopId: string,
	updates: Partial<Pick<SubscriptionRow, "status" | "trial_ends_at">>,
): Promise<void> {
	const { error } = await adminClient()
		.from("subscriptions")
		.update({ ...updates, updated_at: new Date().toISOString() })
		.eq("workshop_id", fixtureWorkshopId);
	if (error) throw error;
}

export async function setFixtureTrialEndsAt(trialEndsAt: Date): Promise<void> {
	await mutateFixtureSubscription(workshopId, {
		trial_ends_at: trialEndsAt.toISOString(),
	});
}

export async function simulateMercadoPagoWebhook(
	fixtureWorkshopId: string,
	options: WebhookSimulationOptions,
): Promise<WebhookEventRow> {
	const client = adminClient();
	const { data: subscription, error: subscriptionError } = await client
		.from("subscriptions")
		.select("provider_preapproval_id")
		.eq("workshop_id", fixtureWorkshopId)
		.single();
	if (subscriptionError || !subscription?.provider_preapproval_id) {
		throw subscriptionError ?? new Error("Fixture subscription has no provider preapproval");
	}
	const resourceKind = options.resourceKind ?? "preapproval";
	const providerStatus = options.providerStatus === "active" ? "authorized" : options.providerStatus === "past_due" ? "pending" : options.providerStatus;
	const rpcClient = client as unknown as {
		rpc(name: string, input: Record<string, unknown>): Promise<{ data: { eventId?: string } | null; error: { message: string } | null }>;
	};
	const { data, error } = await rpcClient.rpc("process_mercadopago_billing_event_v2", {
		contractVersion: 2,
		provider: "mercadopago",
		providerEventId: options.providerEventId,
		eventType: options.eventType,
		resourceKind,
		providerResourceId: options.providerResourceId,
		providerPreapprovalId: options.providerPreapprovalId ?? subscription.provider_preapproval_id,
		providerStatus,
		providerSnapshotAt: options.providerSnapshotAt ?? new Date().toISOString(),
		providerFetchedAt: options.providerFetchedAt ?? new Date().toISOString(),
		normalizedPayload: options.payload ?? { resourceKind },
		...(options.commission ? { commission: options.commission } : {}),
	});
	if (error || !data?.eventId) throw error ?? new Error("Fixture RPC did not return an event");
	const event = await fetchWebhookEventById(data.eventId);
	if (!event) throw new Error("Fixture RPC event was not persisted");
	return event;
}

async function fetchWebhookEventById(eventId: string): Promise<WebhookEventRow | null> {
	const { data, error } = await adminClient()
		.from("billing_webhook_events")
		.select("*")
		.eq("id", eventId)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function insertDuplicateWebhookEvent(
	event: WebhookEventRow,
): Promise<string | null> {
	const { error } = await adminClient().from("billing_webhook_events").insert({
		provider: event.provider,
		provider_event_id: event.provider_event_id,
		event_type: event.event_type,
		provider_resource_id: event.provider_resource_id,
		workshop_id: event.workshop_id,
		payload: event.payload,
		processed_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	});
	return error?.code ?? null;
}

export async function fetchWebhookEvent(
	providerEventId: string,
): Promise<WebhookEventRow | null> {
	const { data, error } = await adminClient()
		.from("billing_webhook_events")
		.select("*")
		.eq("provider", "mercadopago")
		.eq("provider_event_id", providerEventId)
		.maybeSingle();
	if (error) throw error;
	return data;
}
