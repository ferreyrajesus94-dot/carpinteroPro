import { describe, it, expect } from "vitest";
import {
	mapMercadoPagoStatusToAppStatus,
	isValidSignature,
	calculateNextPeriodDates,
	classifyMercadoPagoWebhookType,
} from "../../../supabase/functions/_shared/billing";

describe("mapMercadoPagoStatusToAppStatus", () => {
	it("maps authorized → active", () => {
		expect(mapMercadoPagoStatusToAppStatus("authorized")).toBe("active");
	});
	it("maps active → active", () => {
		expect(mapMercadoPagoStatusToAppStatus("active")).toBe("active");
	});
	it("maps pending → past_due", () => {
		expect(mapMercadoPagoStatusToAppStatus("pending")).toBe("past_due");
	});
	it("maps paused → past_due", () => {
		expect(mapMercadoPagoStatusToAppStatus("paused")).toBe("past_due");
	});
	it("maps rejected → unpaid", () => {
		expect(mapMercadoPagoStatusToAppStatus("rejected")).toBe("unpaid");
	});
	it("maps failure → unpaid", () => {
		expect(mapMercadoPagoStatusToAppStatus("failure")).toBe("unpaid");
	});
	it("maps cancelled → cancelled", () => {
		expect(mapMercadoPagoStatusToAppStatus("cancelled")).toBe("cancelled");
	});
	it("maps unknown → past_due", () => {
		expect(mapMercadoPagoStatusToAppStatus("unknown")).toBe("past_due");
	});
});

describe("isValidSignature", () => {
	it("accepts a correctly computed HMAC-SHA256 signature", async () => {
		const secret = "my-secret";
		const dataId = "preapproval_123";
		const requestId = "req-456";
		const ts = "1716000000";
		const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
		const hash = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		const signature = `ts=${ts},v1=${hash}`;
		const valid = await isValidSignature(
			dataId,
			requestId,
			ts,
			signature,
			secret,
		);
		expect(valid).toBe(true);
	});

	it("accepts MercadoPago simulator signatures that omit missing URL data.id", async () => {
		const secret = "my-secret";
		const requestId = "req-456";
		const ts = "1716000000";
		const manifest = `request-id:${requestId};ts:${ts};`;
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
		const hash = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		const signature = `ts=${ts},v1=${hash}`;
		const valid = await isValidSignature(
			null,
			requestId,
			ts,
			signature,
			secret,
		);
		expect(valid).toBe(true);
	});

	it("rejects an incorrect signature", async () => {
		const valid = await isValidSignature(
			"id",
			"req",
			"123",
			"ts=123,v1=badhash",
			"secret",
		);
		expect(valid).toBe(false);
	});

	it("rejects when secret is empty", async () => {
		const valid = await isValidSignature(
			"id",
			"req",
			"123",
			"ts=123,v1=abcdef",
			"",
		);
		expect(valid).toBe(false);
	});

	it("rejects when signature header is empty", async () => {
		const valid = await isValidSignature("id", "req", "123", "", "secret");
		expect(valid).toBe(false);
	});
});

describe("classifyMercadoPagoWebhookType", () => {
	it("treats subscription preapproval events as preapproval resources", () => {
		expect(classifyMercadoPagoWebhookType("subscription_preapproval")).toBe(
			"preapproval",
		);
		expect(
			classifyMercadoPagoWebhookType("subscription_preapproval.updated"),
		).toBe("preapproval");
	});

	it("keeps legacy preapproval and payment event support", () => {
		expect(classifyMercadoPagoWebhookType("preapproval.updated")).toBe(
			"preapproval",
		);
		expect(classifyMercadoPagoWebhookType("payment")).toBe("payment");
		expect(classifyMercadoPagoWebhookType("payment.created")).toBe("payment");
	});

	it("treats subscription authorized payment events as authorized payment resources", () => {
		expect(
			classifyMercadoPagoWebhookType("subscription_authorized_payment"),
		).toBe("authorized_payment");
		expect(
			classifyMercadoPagoWebhookType("subscription_authorized_payment.updated"),
		).toBe("authorized_payment");
	});

	it("returns unknown for unsupported topics", () => {
		expect(classifyMercadoPagoWebhookType("topic_claims_integration_wh")).toBe(
			"unknown",
		);
	});
});

describe("calculateNextPeriodDates", () => {
	it("returns a 1-month period from the given start date", () => {
		const start = new Date("2026-05-01T00:00:00Z");
		const { starts, ends } = calculateNextPeriodDates(start);
		expect(starts.toISOString()).toBe("2026-05-01T00:00:00.000Z");
		expect(ends.toISOString()).toBe("2026-05-31T00:00:00.000Z");
	});

	it("handles end-of-month correctly (Jan 31 → Mar 2, 30-day interval)", () => {
		const start = new Date("2026-01-31T00:00:00Z");
		const { ends } = calculateNextPeriodDates(start);
		expect(ends.toISOString()).toBe("2026-03-02T00:00:00.000Z");
	});
});

describe("mapMercadoPagoStatusToAppStatus triangulation", () => {
	it("maps empty string → past_due (fail-safe)", () => {
		expect(mapMercadoPagoStatusToAppStatus("")).toBe("past_due");
	});
	it("maps uppercase ACTIVE → active", () => {
		expect(mapMercadoPagoStatusToAppStatus("ACTIVE")).toBe("active");
	});
});
