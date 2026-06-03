import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/shared/types/database";

type TestClient = SupabaseClient<Database>;
type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
type SubscriptionStatus = SubscriptionRow["status"];

const workshopId = "00000000-0000-4000-8000-000000070001";
const fallbackSubscriptionId = "00000000-0000-4000-8000-000000070002";
const email = "e2e_sdd7_active_trial@example.invalid";
const workshopName = "e2e_sdd7_active_trial_workshop";

export function getActiveTrialUser() {
	return {
		email,
		password: readRequiredEnv("E2E_TEST_PASSWORD"),
	} as const;
}

export interface ActiveTrialFixture {
	workshopId: string;
	subscriptionId: string;
	userId: string;
}

export interface SeedOptions {
	trialEndsAt?: Date;
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

async function findUserIdByEmail(client: TestClient): Promise<string | null> {
	let page = 1;
	while (true) {
		const { data, error } = await client.auth.admin.listUsers({
			page,
			perPage: 100,
		});
		if (error) throw error;
		const found = data.users.find((user) => user.email === email);
		if (found) return found.id;
		if (data.users.length < 100) return null;
		page += 1;
	}
}

async function ensureUser(client: TestClient): Promise<string> {
	const user = getActiveTrialUser();
	const existingId = await findUserIdByEmail(client);
	if (existingId) {
		const { error } = await client.auth.admin.updateUserById(existingId, {
			password: user.password,
			email_confirm: true,
			user_metadata: { workshop_name: workshopName },
		});
		if (error) throw error;
		return existingId;
	}
	const { data, error } = await client.auth.admin.createUser({
		email,
		password: user.password,
		email_confirm: true,
		user_metadata: { workshop_name: workshopName },
	});
	if (error) throw error;
	return data.user.id;
}

export async function cleanupSdd7Fixtures(): Promise<void> {
	const client = adminClient();
	const userId = await findUserIdByEmail(client);
	const { data: workshops, error: workshopError } = await client
		.from("workshops")
		.select("id")
		.ilike("name", "e2e_sdd7_%");
	if (workshopError) throw workshopError;
	const workshopIds = [
		workshopId,
		...(workshops ?? []).map((workshop) => workshop.id),
	].filter((id, index, ids) => ids.indexOf(id) === index);

	if (workshopIds.length > 0) {
		await client.from("subscriptions").delete().in("workshop_id", workshopIds);
	}
	if (userId) await client.from("profiles").delete().eq("id", userId);
	if (workshopIds.length > 0) {
		await client.from("workshops").delete().in("id", workshopIds);
	}
	if (userId) {
		const { error } = await client.auth.admin.deleteUser(userId);
		if (error) throw error;
	}
}

export async function seedActiveTrialFixture(
	options: SeedOptions = {},
): Promise<ActiveTrialFixture> {
	const client = adminClient();
	const now = new Date();
	const trialEndsAt =
		options.trialEndsAt ?? new Date(now.getTime() + 7 * 86_400_000);
	const userId = await ensureUser(client);

	const { error: workshopError } = await client
		.from("workshops")
		.upsert({ id: workshopId, name: workshopName });
	if (workshopError) throw workshopError;

	const { error: profileError } = await client.from("profiles").upsert({
		id: userId,
		workshop_id: workshopId,
		display_name: "SDD 7 Active Trial",
		onboarded_at: now.toISOString(),
		terms_accepted_at: now.toISOString(),
		privacy_accepted_at: now.toISOString(),
	});
	if (profileError) throw profileError;

	const subscriptionValues = {
		workshop_id: workshopId,
		status: "trialing" as const,
		plan: "starter" as const,
		provider: "mercadopago" as const,
		trial_starts_at: now.toISOString(),
		trial_ends_at: trialEndsAt.toISOString(),
		current_period_starts_at: null,
		current_period_ends_at: null,
		provider_subscription_id: "e2e_sdd7_subscription",
		provider_preapproval_id: "e2e_sdd7_preapproval",
		provider_status: "authorized",
		cancel_at_period_end: false,
		cancelled_at: null,
		updated_at: now.toISOString(),
	};
	const { data: existingSubscription, error: existingSubscriptionError } =
		await client
			.from("subscriptions")
			.select("id")
			.eq("workshop_id", workshopId)
			.maybeSingle();
	if (existingSubscriptionError) throw existingSubscriptionError;

	const subscriptionWrite = existingSubscription
		? await client
				.from("subscriptions")
				.update(subscriptionValues)
				.eq("workshop_id", workshopId)
				.select("id")
				.single()
		: await client
				.from("subscriptions")
				.insert({ id: fallbackSubscriptionId, ...subscriptionValues })
				.select("id")
				.single();
	if (subscriptionWrite.error) throw subscriptionWrite.error;

	return {
		workshopId,
		subscriptionId: subscriptionWrite.data.id,
		userId,
	};
}

export async function createAuthenticatedFixtureClient(): Promise<TestClient> {
	const client = anonClient();
	const { error } = await client.auth.signInWithPassword(getActiveTrialUser());
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
	const { error } = await adminClient()
		.from("subscriptions")
		.update({ status, updated_at: new Date().toISOString() })
		.eq("workshop_id", workshopId);
	if (error) throw error;
}

export async function setFixtureTrialEndsAt(trialEndsAt: Date): Promise<void> {
	const { error } = await adminClient()
		.from("subscriptions")
		.update({ trial_ends_at: trialEndsAt.toISOString() })
		.eq("workshop_id", workshopId);
	if (error) throw error;
}
