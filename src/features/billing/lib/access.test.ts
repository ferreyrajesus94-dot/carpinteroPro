import { describe, it, expect } from "vitest";
import { getBillingAccess, isTrialActive, formatBillingStatus } from "./access";
import type { SubscriptionRow } from "@/features/billing/types";

function makeSub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
	return {
		id: "sub-1",
		workshop_id: "ws-1",
		status: "trialing",
		plan: "pro_monthly",
		provider: "mercadopago",
		trial_starts_at: "2026-01-01T00:00:00Z",
		trial_ends_at: "2026-01-15T00:00:00Z",
		current_period_starts_at: null,
		current_period_ends_at: null,
		provider_subscription_id: null,
		provider_preapproval_id: null,
		provider_status: null,
		cancel_at_period_end: false,
		cancelled_at: null,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

describe("getBillingAccess", () => {
	it("returns loading when subscription is null", () => {
		expect(getBillingAccess(null, new Date())).toBe("loading");
	});

	it("returns loading when subscription is undefined", () => {
		expect(getBillingAccess(undefined, new Date())).toBe("loading");
	});

	it("returns allowed when status is active", () => {
		const sub = makeSub({ status: "active" });
		expect(getBillingAccess(sub, new Date())).toBe("allowed");
	});

	it("returns allowed when trialing and trial_ends_at is in the future", () => {
		const sub = makeSub({
			status: "trialing",
			trial_ends_at: "2099-01-01T00:00:00Z",
		});
		expect(getBillingAccess(sub, new Date("2026-01-01T00:00:00Z"))).toBe(
			"allowed",
		);
	});

	it("returns blocked when trialing and trial_ends_at is in the past", () => {
		const sub = makeSub({
			status: "trialing",
			trial_ends_at: "2026-01-14T23:59:59Z",
		});
		expect(getBillingAccess(sub, new Date("2026-01-15T00:00:00Z"))).toBe(
			"blocked",
		);
	});

	it("returns blocked when trialing and trial_ends_at is exactly now (strict)", () => {
		const sub = makeSub({
			status: "trialing",
			trial_ends_at: "2026-01-15T00:00:00Z",
		});
		expect(getBillingAccess(sub, new Date("2026-01-15T00:00:00Z"))).toBe(
			"blocked",
		);
	});

	it("returns blocked for past_due", () => {
		const sub = makeSub({ status: "past_due" });
		expect(getBillingAccess(sub, new Date())).toBe("blocked");
	});

	it("returns blocked for unpaid", () => {
		const sub = makeSub({ status: "unpaid" });
		expect(getBillingAccess(sub, new Date())).toBe("blocked");
	});

	it("returns blocked for cancelled", () => {
		const sub = makeSub({ status: "cancelled" });
		expect(getBillingAccess(sub, new Date())).toBe("blocked");
	});

	it("returns allowed when cancel_at_period_end is true and period is still active", () => {
		const sub = makeSub({
			status: "active",
			cancel_at_period_end: true,
			current_period_ends_at: "2099-12-31T23:59:59Z",
		});
		expect(getBillingAccess(sub, new Date())).toBe("allowed");
	});

	it("returns blocked when cancel_at_period_end is true and period has ended", () => {
		const sub = makeSub({
			status: "active",
			cancel_at_period_end: true,
			current_period_ends_at: "2026-01-01T00:00:00Z",
		});
		expect(getBillingAccess(sub, new Date("2026-01-01T00:00:01Z"))).toBe(
			"blocked",
		);
	});
});

describe("isTrialActive", () => {
	it("returns true when trialing and trial_ends_at is in the future", () => {
		const sub = makeSub({
			status: "trialing",
			trial_ends_at: "2099-01-01T00:00:00Z",
		});
		expect(isTrialActive(sub, new Date())).toBe(true);
	});

	it("returns false when trialing and trial_ends_at is in the past", () => {
		const sub = makeSub({
			status: "trialing",
			trial_ends_at: "2020-01-01T00:00:00Z",
		});
		expect(isTrialActive(sub, new Date())).toBe(false);
	});

	it("returns false when not trialing", () => {
		const sub = makeSub({ status: "active" });
		expect(isTrialActive(sub, new Date())).toBe(false);
	});
});

describe("formatBillingStatus", () => {
	it("formats trialing", () => {
		expect(formatBillingStatus(makeSub({ status: "trialing" }))).toBe(
			"Período de prueba",
		);
	});

	it("formats active", () => {
		expect(formatBillingStatus(makeSub({ status: "active" }))).toBe(
			"Suscripción activa",
		);
	});

	it("formats past_due", () => {
		expect(formatBillingStatus(makeSub({ status: "past_due" }))).toBe(
			"Pago pendiente",
		);
	});

	it("formats unpaid", () => {
		expect(formatBillingStatus(makeSub({ status: "unpaid" }))).toBe(
			"Suscripción suspendida por falta de pago",
		);
	});

	it("formats cancelled", () => {
		expect(formatBillingStatus(makeSub({ status: "cancelled" }))).toBe(
			"Suscripción cancelada",
		);
	});
});
