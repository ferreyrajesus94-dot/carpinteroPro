import { describe, expect, it } from "vitest";
import { mapFixtureProviderStatus } from "./fixtures";
import {
	mapMercadoPagoStatusToAppStatus,
	type SubscriptionStatus,
} from "../../supabase/functions/_shared/billing";

type FixtureMapper = (providerStatus: string) => SubscriptionStatus;

// Table-driven parity contract: every (providerStatus, expectedAppStatus)
// pair MUST match the production mapper at
// supabase/functions/_shared/billing.ts. The fixture previously held an
// inline stub that only handled authorized/active and aliased every other
// branch to past_due -- which silently dropped rejected, failure, and
// cancelled. Triangulation covers lower-case branches, mixed case, the
// fail-safe fallback, and unknown values.
const PARITY_TABLE: ReadonlyArray<readonly [string, SubscriptionStatus]> = [
	["authorized", "active"],
	["active", "active"],
	["pending", "past_due"],
	["paused", "past_due"],
	["rejected", "unpaid"],
	["failure", "unpaid"],
	["cancelled", "cancelled"],
	["unknown", "past_due"],
	["", "past_due"],
	["ACTIVE", "active"],
	["Authorized", "active"],
	["REJECTED", "unpaid"],
	["Failure", "unpaid"],
	["Cancelled", "cancelled"],
	["approved", "past_due"],
	["failed", "past_due"],
];

describe("fixture provider status mapper parity", () => {
	const fixtureMapper: FixtureMapper = mapFixtureProviderStatus;

	it.each(PARITY_TABLE)(
		"maps %s to %s (matches production)",
		(providerStatus, expected) => {
			expect(fixtureMapper(providerStatus)).toBe(expected);
			// Identity contract: the fixture mapper MUST produce the
			// same value as production for every input. If a future
			// edit re-introduces a divergent inline stub, this catches
			// it even if the per-row assertions above happen to be
			// deleted or reordered.
			expect(mapMercadoPagoStatusToAppStatus(providerStatus)).toBe(
				expected,
			);
			expect(fixtureMapper(providerStatus)).toBe(
				mapMercadoPagoStatusToAppStatus(providerStatus),
			);
		},
	);
});