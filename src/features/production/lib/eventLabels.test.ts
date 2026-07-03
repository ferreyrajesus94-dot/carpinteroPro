import { describe, it, expect } from "vitest";
import {
	resolveEventType,
	resolveEventTypeFromColumn,
	resolveEventTypeLabel,
	type ProductionOrderEventTypeKind,
} from "./eventLabels";

/**
 * Pure helper tests — no mocks needed. The production-order event
 * timeline depends on a stable mapping from a `production_order_events`
 * row's `event_type` and `from_state`/`to_state` triple to a UI label
 * + icon kind. These are pure functions, so the test layer is plain
 * Vitest without RTL.
 */
describe("resolveEventType", () => {
	it("returns 'created' when from_state is null and to_state is set", () => {
		expect(resolveEventType(null, "planned")).toBe("created");
		expect(resolveEventType(null, "in_progress")).toBe("created");
	});

	it("returns 'transitioned' for a normal state change", () => {
		expect(resolveEventType("planned", "in_progress")).toBe("transitioned");
		expect(resolveEventType("in_progress", "quality_check")).toBe("transitioned");
		expect(resolveEventType("quality_check", "ready")).toBe("transitioned");
		expect(resolveEventType("ready", "delivered")).toBe("delivered");
	});

	it("returns 'cancelled' when to_state is cancelled regardless of from_state", () => {
		expect(resolveEventType("planned", "cancelled")).toBe("cancelled");
		expect(resolveEventType("in_progress", "cancelled")).toBe("cancelled");
		expect(resolveEventType("ready", "cancelled")).toBe("cancelled");
	});

	it("returns 'delivered' when to_state is delivered regardless of from_state", () => {
		expect(resolveEventType("ready", "delivered")).toBe("delivered");
	});

	it("returns 'resumed' when transitioning from paused to in_progress", () => {
		expect(resolveEventType("paused", "in_progress")).toBe("resumed");
	});

	it("returns 'paused' when transitioning to paused from in_progress", () => {
		expect(resolveEventType("in_progress", "paused")).toBe("paused");
	});
});

describe("resolveEventTypeFromColumn", () => {
	// PR 7: the SQL helper writes a stable event_type string on every
	// event row. The frontend MUST prefer that string over the
	// (from_state, to_state)-derived label so the timeline UI is
	// driven by the canonical label the server computed. The
	// (from_state, to_state) pair is a fallback for pre-PR 7 data
	// (where event_type IS NULL) and for future event_type values
	// the client hasn't been updated for.

	it("prefers the SQL-provided event_type over the state-derived label", () => {
		// Server wrote event_type = 'resumed' (canonical), but a
		// stale client would derive 'transitioned' from
		// (paused, in_progress). The client must trust the server.
		expect(
			resolveEventTypeFromColumn("resumed", "paused", "in_progress"),
		).toBe("resumed");

		// Server wrote event_type = 'created' (canonical), client
		// would otherwise derive 'transitioned' for (planned,
		// in_progress). Trust the server.
		expect(
			resolveEventTypeFromColumn("created", "planned", "in_progress"),
		).toBe("created");
	});

	it("falls back to the state-derived label when event_type is null", () => {
		expect(resolveEventTypeFromColumn(null, null, "planned")).toBe("created");
		expect(resolveEventTypeFromColumn(null, "paused", "in_progress")).toBe(
			"resumed",
		);
		expect(resolveEventTypeFromColumn(null, "ready", "delivered")).toBe(
			"delivered",
		);
	});

	it("falls back to the state-derived label when event_type is undefined", () => {
		expect(
			resolveEventTypeFromColumn(undefined, "planned", "in_progress"),
		).toBe("transitioned");
	});

	it("falls back to the state-derived label when event_type is an empty string", () => {
		expect(
			resolveEventTypeFromColumn("", "in_progress", "paused"),
		).toBe("paused");
	});

	it("falls back to the state-derived label when event_type is unknown (future kind the client has not been updated for)", () => {
		// The SQL CHECK constraint limits the column to the 6 known
		// kinds, so a database typo is impossible. A future kind
		// (e.g. a new label added server-side) could land in
		// production before the client is updated; the fallback
		// keeps the timeline renderable.
		expect(
			resolveEventTypeFromColumn("rolled_back", "in_progress", "planned"),
		).toBe("transitioned");
	});

	it("accepts all six known event_type kinds verbatim", () => {
		const known: ProductionOrderEventTypeKind[] = [
			"created",
			"transitioned",
			"resumed",
			"paused",
			"cancelled",
			"delivered",
		];
		for (const k of known) {
			expect(
				resolveEventTypeFromColumn(k, "in_progress", "quality_check"),
			).toBe(k);
		}
	});
});

describe("resolveEventTypeLabel", () => {
	it("returns a Spanish label for every event-type kind", () => {
		const kinds: ProductionOrderEventTypeKind[] = [
			"created",
			"transitioned",
			"resumed",
			"paused",
			"cancelled",
			"delivered",
		];
		for (const k of kinds) {
			expect(resolveEventTypeLabel(k)).toMatch(/\S+/);
		}
	});

	it("the label for 'created' mentions creation/Planificado", () => {
		expect(resolveEventTypeLabel("created")).toMatch(/cread|planificado/i);
	});

	it("the label for 'cancelled' mentions Cancelado", () => {
		expect(resolveEventTypeLabel("cancelled")).toMatch(/cancelad/i);
	});

	it("the label for 'delivered' mentions Entregado", () => {
		expect(resolveEventTypeLabel("delivered")).toMatch(/entregad/i);
	});

	it("the label for 'resumed' mentions Reanudado", () => {
		expect(resolveEventTypeLabel("resumed")).toMatch(/reanudad/i);
	});

	it("the label for 'paused' mentions Pausado", () => {
		expect(resolveEventTypeLabel("paused")).toMatch(/pausad/i);
	});
});
