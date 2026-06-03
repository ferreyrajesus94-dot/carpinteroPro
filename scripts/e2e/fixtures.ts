import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../src/shared/types/database";

type TestClient = SupabaseClient<Database>;
type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
type SubscriptionStatus = SubscriptionRow["status"];
type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];
type WebhookEventRow =
	Database["public"]["Tables"]["billing_webhook_events"]["Row"];

const workshopId = "00000000-0000-4000-8000-000000070001";
const fallbackSubscriptionId = "00000000-0000-4000-8000-000000070002";
const secondWorkshopId = "00000000-0000-4000-8000-000000070003";
const secondSubscriptionId = "00000000-0000-4000-8000-000000070004";
const materialAId = "00000000-0000-4000-8000-000000070005";
const materialBId = "00000000-0000-4000-8000-000000070006";
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

export interface WebhookSimulationOptions {
	providerEventId: string;
	eventType: string;
	providerResourceId: string;
	providerStatus: SubscriptionStatus;
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
	const now = new Date().toISOString();
	const { data: event, error: insertError } = await client
		.from("billing_webhook_events")
		.insert({
			provider: "mercadopago",
			provider_event_id: options.providerEventId,
			event_type: options.eventType,
			provider_resource_id: options.providerResourceId,
			workshop_id: fixtureWorkshopId,
			payload: options.payload ?? {
				data: { id: options.providerResourceId },
				type: options.eventType,
			},
			processed_at: now,
			updated_at: now,
		})
		.select("*")
		.single();
	if (insertError) throw insertError;

	const { error: updateError } = await client
		.from("subscriptions")
		.update({
			status: options.providerStatus,
			provider_status: options.providerStatus,
			current_period_starts_at:
				options.providerStatus === "active" ? now : undefined,
			current_period_ends_at:
				options.providerStatus === "active"
					? new Date(Date.now() + 30 * 86_400_000).toISOString()
					: undefined,
			updated_at: now,
		})
		.eq("workshop_id", fixtureWorkshopId);
	if (updateError) throw updateError;

	return event;
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
