import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupportEmail, getSupportMailtoHref } from "./supportContact";

describe("supportContact", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns a trimmed configured support email", () => {
		expect(getSupportEmail(" soporte@example.com ")).toBe(
			"soporte@example.com",
		);
	});

	it("returns null for a missing or invalid support email", () => {
		expect(getSupportEmail("")).toBeNull();
		expect(getSupportEmail("not-an-email")).toBeNull();
	});

	it("builds an encoded mailto href when email is configured", () => {
		expect(
			getSupportMailtoHref({
				email: "soporte@example.com",
				subject: "Ayuda con suscripción",
				body: "Necesito ayuda con un error",
			}),
		).toBe(
			"mailto:soporte@example.com?subject=Ayuda%20con%20suscripci%C3%B3n&body=Necesito%20ayuda%20con%20un%20error",
		);
	});

	it("does not build a broken mailto href without a valid email", () => {
		expect(getSupportMailtoHref({ email: "" })).toBeNull();
	});

	it("treats null email as an explicit disabled support link", () => {
		vi.stubEnv("VITE_SUPPORT_EMAIL", "soporte@example.com");

		expect(getSupportMailtoHref({ email: null })).toBeNull();
	});
});
