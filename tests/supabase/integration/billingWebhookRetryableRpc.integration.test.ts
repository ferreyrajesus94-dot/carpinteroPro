// @ts-expect-error -- Node types are intentionally excluded from the browser build.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

import { afterEach, describe, expect, it } from "vitest";

const ENABLED = import.meta.env.RUN_LOCAL_SUPABASE_INTEGRATION === "true";
const url = import.meta.env.E2E_SUPABASE_URL;
const key = import.meta.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const fixtureIds: string[] = [];

function localConfig(): { url: string; key: string } {
	if (!url || !key) throw new Error("Local RPC integration requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY when RUN_LOCAL_SUPABASE_INTEGRATION=true.");
	if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname)) throw new Error("Local RPC integration rejects a non-loopback E2E_SUPABASE_URL.");
	return { url, key };
}

function query(sql: string, variables: Record<string, string>) {
	const container = execFileSync("docker", ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"], { encoding: "utf8" }).trim();
	if (!container) throw new Error("Local Supabase database container is unavailable.");
	const arguments_ = Object.entries(variables).flatMap(([name, value]) => ["-v", `${name}=${value}`]);
	execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", ...arguments_], { input: sql, stdio: "pipe" });
}

function fixture() {
	const suffix = crypto.randomUUID(); const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]; fixtureIds.push(...ids);
	const [workshop, subscription, youtuber, code, payment] = ids; const preapproval = `preapproval_${suffix}`;
	query("WITH workshop AS (INSERT INTO public.workshops (id,name) VALUES (:'workshop'::uuid, :'name')), youtuber AS (INSERT INTO public.youtubers (id,display_name) VALUES (:'youtuber'::uuid, :'name')), referral_code AS (INSERT INTO public.referral_codes (id,youtuber_id,code,discount_pct,commission_pct) VALUES (:'code'::uuid, :'youtuber'::uuid, :'name',0,10)), referral AS (INSERT INTO public.workshop_referrals (workshop_id,referral_code_id,youtuber_id) VALUES (:'workshop'::uuid, :'code'::uuid, :'youtuber'::uuid)) INSERT INTO public.subscriptions (id,workshop_id,status,provider,provider_preapproval_id) VALUES (:'subscription'::uuid, :'workshop'::uuid,'trialing','mercadopago', :'preapproval');", { workshop, subscription, youtuber, code, preapproval, name: `rpc-${suffix}` });
	return { workshop, subscription, payment, preapproval };
}

function input(preapproval: string, payment: string, eventId = `event_${crypto.randomUUID()}`) {
	return { contractVersion: 2, provider: "mercadopago", providerEventId: eventId, eventType: "authorized_payment.created", resourceKind: "authorized_payment", providerResourceId: payment, providerPreapprovalId: preapproval, providerStatus: "authorized", providerSnapshotAt: "2026-07-15T10:00:00.000Z", providerFetchedAt: "2026-07-15T10:01:00.000Z", normalizedPayload: {}, commission: { providerPaymentId: payment, paymentAmount: 10, currency: "ARS", occurredAt: "2026-07-15T10:00:00.000Z" } };
}

function clean() {
	for (const id of fixtureIds.splice(0)) for (const sql of ["DELETE FROM public.billing_webhook_events WHERE workshop_id=:'id'::uuid;", "DELETE FROM public.referral_commissions WHERE workshop_id=:'id'::uuid;", "DELETE FROM public.workshop_referrals WHERE workshop_id=:'id'::uuid;", "DELETE FROM public.subscriptions WHERE workshop_id=:'id'::uuid;", "DELETE FROM public.referral_codes WHERE id=:'id'::uuid;", "DELETE FROM public.youtubers WHERE id=:'id'::uuid;", "DELETE FROM public.workshops WHERE id=:'id'::uuid;"]) query(sql, { id });
}

describe("process_mercadopago_billing_event_v2 local PostgREST integration", () => {
	if (!ENABLED) {
		it.skip("requires RUN_LOCAL_SUPABASE_INTEGRATION=true; it never substitutes remote credentials or URLs", () => {});
		return;
	}
	const config = localConfig();
	const supabase = createClient(config.url, config.key);
	afterEach(clean, 30_000);

	it("commits one commission for same-event Promise.all and completed duplicates", async () => {
		const row = fixture(); const payload = input(row.preapproval, row.payment);
		const [first, second] = await Promise.all([supabase.rpc("process_mercadopago_billing_event_v2", { p_input: payload }), supabase.rpc("process_mercadopago_billing_event_v2", { p_input: payload })]);
		expect(first.error).toBeNull(); expect(second.error).toBeNull();
		const outcomes = [first.data, second.data];
		expect(outcomes.filter((result) => result.outcome === "completed" && result.applied === true)).toHaveLength(1);
		expect(outcomes.filter((result) => result.outcome === "duplicate" && result.applied === false)).toHaveLength(1);
		const duplicate = await supabase.rpc("process_mercadopago_billing_event_v2", { p_input: payload });
		expect(duplicate.data).toMatchObject({ outcome: "duplicate", applied: false });
		const { data: events } = await supabase.from("billing_webhook_events").select("id,outcome").eq("provider_event_id", payload.providerEventId);
		const { data } = await supabase.from("referral_commissions").select("id").eq("provider_payment_id", row.payment);
		expect(events).toEqual([expect.objectContaining({ outcome: "completed" })]); expect(data).toHaveLength(1);
	}, 30_000);

	it("records retryable rollback for a commission conflict and completes its corrected retry", async () => {
		const row = fixture(); const payload = input(row.preapproval, row.payment);
		query("INSERT INTO public.referral_commissions (workshop_id,youtuber_id,referral_code_id,subscription_id,provider_payment_id,payment_amount,commission_pct,commission_amount,currency,occurred_at) SELECT workshop_id,youtuber_id,referral_code_id,:'subscription'::uuid,:'payment',99,10,9.9,'ARS','2026-07-15T10:00:00Z' FROM public.workshop_referrals WHERE workshop_id=:'workshop'::uuid;", row);
		const failed = await supabase.rpc("process_mercadopago_billing_event_v2", { p_input: payload });
		expect(failed.error).toBeNull(); expect(failed.data).toMatchObject({ outcome: "retryable", retryable: true });
		const before = await supabase.from("subscriptions").select("status").eq("id", row.subscription).single();
		const { data: retryableEvents } = await supabase.from("billing_webhook_events").select("outcome,outcome_reason").eq("provider_event_id", payload.providerEventId);
		expect(before.data).toMatchObject({ status: "trialing" });
		expect(retryableEvents).toEqual([expect.objectContaining({ outcome: "retryable", outcome_reason: "local_failure" })]);
		query("DELETE FROM public.referral_commissions WHERE provider_payment_id=:'payment';", row);
		const retried = await supabase.rpc("process_mercadopago_billing_event_v2", { p_input: payload });
		expect(retried.error).toBeNull(); expect(retried.data).toMatchObject({ outcome: "completed" });
	}, 30_000);
});
