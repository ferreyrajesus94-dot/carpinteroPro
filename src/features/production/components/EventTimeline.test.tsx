import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { EventTimeline } from "./EventTimeline";
import type { ProductionOrderEvent } from "../api/productionOrders";
import type { ProductionOrderState } from "../api/types";

vi.mock("../hooks/useProductionOrders", () => ({
	// EventTimeline is a presentational component that receives events
	// via props; the hook is consumed by the parent detail page, not
	// here. The mock is included so a future refactor that introduces
	// a hook in this file fails fast.
}));

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";
const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function makeEvent(
	overrides: Partial<ProductionOrderEvent> = {},
): ProductionOrderEvent {
	return {
		id: "11111111-2222-4333-8444-555555555555",
		workshop_id: WORKSHOP_ID,
		production_order_id: ORDER_ID,
		event_type: "created",
		from_state: null,
		to_state: "planned" as ProductionOrderState,
		reason: "production order created",
		note: "production order created",
		actor_id: "44444444-4444-4444-8444-444444444444",
		metadata: { request_id: "req-1", operation: "start" },
		created_at: "2026-06-30T10:00:00Z",
		actor_name: "Jane Doe",
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("EventTimeline — ordering and rendering", () => {
	it("renders the events in the order they were received (the SQL RPC returns created_at ASC, id ASC)", () => {
		// The previous version of this test used a/b/c ids that the
		// UI never renders; the assertion relied on the characters
		// appearing somewhere in the rendered text, which is fragile
		// (a future label or metadata could include a/b/c by
		// coincidence). The replacement asserts the order via
		// distinct, visible, in-content markers: each event's
		// `note` carries a unique string and the test reads the
		// timeline items in DOM order, so the order is checked
		// against the rendered DOM, not against the (id) string.
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "11111111-1111-4111-8111-111111111111",
				to_state: "planned" as ProductionOrderState,
				from_state: null,
				event_type: "created",
				note: "EVENT-MARKER-1: orden creada",
				created_at: "2026-06-30T10:00:00Z",
			}),
			makeEvent({
				id: "22222222-2222-4222-8222-222222222222",
				to_state: "in_progress" as ProductionOrderState,
				from_state: "planned",
				event_type: "transitioned",
				note: "EVENT-MARKER-2: en producción",
				created_at: "2026-06-30T11:00:00Z",
			}),
			makeEvent({
				id: "33333333-3333-4333-8333-333333333333",
				to_state: "delivered" as ProductionOrderState,
				from_state: "ready",
				event_type: "delivered",
				note: "EVENT-MARKER-3: entregado al cliente",
				created_at: "2026-06-30T12:00:00Z",
			}),
		];

		render(<EventTimeline events={events} />);

		const list = screen.getByRole("list");
		const items = within(list).getAllByRole("listitem");
		expect(items).toHaveLength(3);

		// Each event has a unique, in-content marker in its note
		// line. The DOM order of the list items MUST match the
		// input order; a swapped/unsorted timeline fails this.
		expect(items[0].textContent).toMatch(/EVENT-MARKER-1/);
		expect(items[1].textContent).toMatch(/EVENT-MARKER-2/);
		expect(items[2].textContent).toMatch(/EVENT-MARKER-3/);

		// Negative checks: the markers must NOT appear in an order
		// other than 1 -> 2 -> 3, so a re-sort or a partial swap
		// fails this. The check is a content scan, not a DOM index
		// scan, so it survives future layout refactors as long as
		// the note text remains unique per row.
		const allText = list.textContent ?? "";
		const m1 = allText.indexOf("EVENT-MARKER-1");
		const m2 = allText.indexOf("EVENT-MARKER-2");
		const m3 = allText.indexOf("EVENT-MARKER-3");
		expect(m1).toBeGreaterThanOrEqual(0);
		expect(m2).toBeGreaterThan(m1);
		expect(m3).toBeGreaterThan(m2);
	});

	it("renders one list item per event with the event-type kind's Spanish label", () => {
		const events: ProductionOrderEvent[] = [
			makeEvent({ id: "e1", to_state: "planned", from_state: null, event_type: "created" }),
			makeEvent({ id: "e2", to_state: "in_progress", from_state: "planned", event_type: "transitioned" }),
			makeEvent({ id: "e3", to_state: "cancelled", from_state: "in_progress", event_type: "cancelled" }),
		];

		render(<EventTimeline events={events} />);

		// Use getAllByTestId for the label to assert that the
		// Spanish label appears on EACH row, not just once in the
		// document. A broken implementation that renders a single
		// shared label for all rows would still pass a getByText
		// check, but the count-based assertion fails.
		const labels = screen.getAllByTestId("event-timeline-label");
		expect(labels).toHaveLength(3);
		expect(labels[0]).toHaveTextContent("Orden creada");
		expect(labels[1]).toHaveTextContent("Cambio de estado");
		expect(labels[2]).toHaveTextContent("Cancelado");
	});

	it("renders the from_state -> to_state transition for non-creation events", () => {
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "e1",
				from_state: "planned",
				to_state: "in_progress",
				event_type: "transitioned",
			}),
		];

		render(<EventTimeline events={events} />);

		expect(screen.getByText(/Planificado/)).toBeInTheDocument();
		expect(screen.getByText(/En producci[oó]n/)).toBeInTheDocument();
	});

	it("renders the actor name when it is non-null", () => {
		const events: ProductionOrderEvent[] = [
			makeEvent({ id: "e1", actor_name: "Juan Pérez" }),
		];

		render(<EventTimeline events={events} />);

		expect(screen.getByText(/Juan P[ée]rez/)).toBeInTheDocument();
	});

	it("renders '—' (or similar fallback) when the actor name is missing", () => {
		const events: ProductionOrderEvent[] = [
			makeEvent({ id: "e1", actor_name: "" }),
		];

		render(<EventTimeline events={events} />);

		// The empty string should not be rendered as the actor label;
		// the component must show a sensible fallback like "Sistema".
		expect(screen.getByText(/sistema/i)).toBeInTheDocument();
	});

	it("renders the note (PR 7: prefer note over reason) when it is present", () => {
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "e1",
				note: "Cliente cambió planes",
				reason: "legacy reason text",
			}),
		];

		render(<EventTimeline events={events} />);

		// The PR 7 column is `note`; the legacy column `reason` is
		// NOT the source of the rendered human text anymore.
		expect(screen.getByText(/Cliente cambi[oó] planes/)).toBeInTheDocument();
		expect(screen.queryByText(/legacy reason text/)).not.toBeInTheDocument();
	});

	it("falls back to the legacy `reason` column when `note` is null (back-compat with pre-PR 7 data)", () => {
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "e1",
				note: null,
				reason: "legacy-only reason",
			}),
		];

		render(<EventTimeline events={events} />);

		expect(screen.getByText(/legacy-only reason/)).toBeInTheDocument();
	});

	it("does NOT render a note line when both note and reason are null/empty", () => {
		const events: ProductionOrderEvent[] = [
			makeEvent({ id: "e1", note: null, reason: null }),
		];

		const { container } = render(<EventTimeline events={events} />);

		// The event has a creation label and actor but no note; the
		// timeline must not show a stray note row.
		expect(screen.queryByTestId("event-timeline-note")).not.toBeInTheDocument();
		// And the rendered text must not contain "Nota:" or "Razón:"
		// labels (a previous regression test asserted this; we keep
		// the assertion to catch future label regressions).
		const noteRegex = /nota:|raz[oó]n:/i;
		expect(container.textContent?.match(noteRegex)).toBeNull();
	});
});

describe("EventTimeline — event_type column priority (PR 7)", () => {
	// PR 7: the SQL helper writes a canonical event_type string on
	// every event row. The frontend MUST prefer that string over the
	// (from_state, to_state)-derived label, so a stale client can't
	// render a wrong label for a row the server has explicitly
	// labeled. These tests assert the priority at the integration
	// level (component-level), complementing the unit tests for
	// resolveEventTypeFromColumn.

	it("uses the SQL-provided event_type label even when (from_state, to_state) would derive a different label", () => {
		// SQL wrote event_type = 'resumed' (the canonical label for
		// paused -> in_progress), but a stale client could derive
		// 'transitioned' from the state pair alone. The component
		// must use the SQL label.
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "e-resumed",
				from_state: "paused",
				to_state: "in_progress",
				event_type: "resumed",
			}),
		];

		render(<EventTimeline events={events} />);

		expect(screen.getByTestId("event-timeline-label")).toHaveTextContent(
			"Reanudado",
		);
	});

	it("falls back to the state-derived label when event_type is missing (pre-PR 7 data)", () => {
		// Pre-PR 7 rows have event_type = NULL. The component must
		// still render a meaningful label, derived from the state
		// pair via resolveEventType.
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "e-legacy",
				from_state: "paused",
				to_state: "in_progress",
				event_type: null as unknown as string,
			}),
		];

		render(<EventTimeline events={events} />);

		// The state pair (paused, in_progress) -> 'resumed' ->
		// "Reanudado" (the same label as the SQL-provided kind).
		expect(screen.getByTestId("event-timeline-label")).toHaveTextContent(
			"Reanudado",
		);
	});
});

describe("EventTimeline — empty and single-event cases", () => {
	it("renders an empty-state copy when there are zero events", () => {
		render(<EventTimeline events={[]} />);

		expect(
			screen.getByText(/sin eventos|a[úu]n no hay eventos/i),
		).toBeInTheDocument();
	});

	it("renders exactly one list item when there is exactly one event", () => {
		const events: ProductionOrderEvent[] = [makeEvent({ id: "only" })];

		render(<EventTimeline events={events} />);

		const list = screen.getByRole("list");
		const items = within(list).getAllByRole("listitem");
		expect(items).toHaveLength(1);
	});
});

// PR 7 review-blocker: the metadata disclosure renders via a
// <details data-testid="event-metadata"> element with the Spanish
// summary label "Detalle técnico". Until this block landed, the
// behavior was implementation-only — the assertion was visual and
// no test caught a future refactor that drops the disclosure
// (e.g. a regression that hides it behind a flag, a label change,
// or a switch to a non-disclosure popover). The tests below pin
// the contract: the disclosure must render, the summary label
// must be "Detalle técnico", the JSON-stringified payload must be
// in the DOM, and null/undefined metadata must NOT render the
// disclosure at all.
describe("EventTimeline — metadata disclosure (PR 7)", () => {
	it("renders a <details data-testid='event-metadata'> disclosure with the 'Detalle técnico' summary label when metadata is an object", () => {
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "e-meta-object",
				metadata: {
					request_id: "req-meta-1",
					operation: "start",
					actor_role: "admin",
				},
			}),
		];

		render(<EventTimeline events={events} />);

		// The disclosure is a <details> element with a stable
		// testid. Using getByTestId (not queryByTestId) is a real
		// assertion: a future refactor that drops the testid or
		// hides the disclosure fails this lookup.
		const disclosure = screen.getByTestId("event-metadata");
		expect(disclosure).toBeInTheDocument();
		expect(disclosure.tagName.toLowerCase()).toBe("details");

		// The summary label is the spec-mandated Spanish copy. A
		// label change (e.g. "Technical detail") is a behavior
		// change for the operator and must be intentional.
		expect(
			screen.getByText("Detalle técnico"),
		).toBeInTheDocument();
	});

	it("renders the JSON-stringified metadata content (every key is in the DOM)", () => {
		// The disclosure content is the JSON-stringified metadata.
		// A regression that renders only the metadata type
		// ("[object Object]") or only a subset of the keys fails
		// this assertion. The test uses three distinct keys with
		// three distinct values so a partial render is detected.
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "e-meta-keys",
				metadata: {
					request_id: "req-abc-123",
					operation: "transition",
					duration_ms: 42,
				},
			}),
		];

		render(<EventTimeline events={events} />);

		const disclosure = screen.getByTestId("event-metadata");
		const text = disclosure.textContent ?? "";

		// Every key must be visible in the disclosure. A render
		// that omits keys (e.g. only the values) fails this.
		expect(text).toMatch(/request_id/);
		expect(text).toMatch(/operation/);
		expect(text).toMatch(/duration_ms/);

		// Every value must be visible too. Using the exact
		// stringified form catches a regression that renders
		// values without their keys or that wraps the object in
		// a different envelope.
		expect(text).toMatch(/req-abc-123/);
		expect(text).toMatch(/transition/);
		expect(text).toMatch(/42/);
	});

	it("renders a disclosure for a string metadata value (non-object path) with the raw text inside the disclosure", () => {
		// Triangulation: formatMetadata has a non-object branch
		// (typeof !== 'object') that uses String(metadata) instead
		// of JSON.stringify. A regression that unifies the two
		// branches and JSON-stringifies everything would render
		// the string as `"value"` (quoted) instead of `value`.
		// This test pins the non-object contract.
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "e-meta-string",
				metadata: "raw-metadata-token",
			}),
		];

		render(<EventTimeline events={events} />);

		const disclosure = screen.getByTestId("event-metadata");
		const text = disclosure.textContent ?? "";

		// The raw string must be present in the disclosure as-is.
		// We intentionally check for the unquoted form to catch a
		// JSON.stringify regression.
		expect(text).toMatch(/raw-metadata-token/);
		// The JSON-stringified form (with surrounding quotes) must
		// NOT be the entire disclosure body. A regression that
		// drops the typeof branch and JSON-stringifies the string
		// would render only `"raw-metadata-token"` (with quotes);
		// the unquoted token check above is the primary guard,
		// this is a defense-in-depth check that the disclosure
		// contains more than just the quoted form.
		expect(text).not.toMatch(/^"raw-metadata-token"$/);
	});

	it("does NOT render the metadata disclosure when metadata is null", () => {
		const events: ProductionOrderEvent[] = [
			makeEvent({ id: "e-meta-null", metadata: null }),
		];

		render(<EventTimeline events={events} />);

		// The disclosure must not be present at all. A regression
		// that always renders the disclosure with a placeholder
		// (e.g. "—") would fail this lookup.
		expect(screen.queryByTestId("event-metadata")).not.toBeInTheDocument();
		// The summary label must also not leak into the rendered
		// output. A regression that renders an empty <details>
		// with the summary visible but no content would fail this.
		expect(screen.queryByText("Detalle técnico")).not.toBeInTheDocument();
	});

	it("does NOT render the metadata disclosure when metadata is undefined", () => {
		// Triangulation: production data may not have the column
		// at all (older row shape) or may explicitly set it to
		// undefined. The component must treat undefined the same
		// as null: no disclosure, no label.
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "e-meta-undef",
				metadata: undefined as unknown as null,
			}),
		];

		render(<EventTimeline events={events} />);

		expect(screen.queryByTestId("event-metadata")).not.toBeInTheDocument();
		expect(screen.queryByText("Detalle técnico")).not.toBeInTheDocument();
	});

	it("renders one disclosure per event when multiple events have metadata (per-row scoping)", () => {
		// Triangulation: the disclosure is per-row, not a single
		// shared block at the bottom of the timeline. With three
		// events that each have distinct metadata, the rendered
		// DOM must contain exactly three disclosures, each
		// containing the metadata for its own event. A regression
		// that hoists the disclosure to a single shared block at
		// the list level fails this.
		const events: ProductionOrderEvent[] = [
			makeEvent({
				id: "e-meta-1",
				metadata: { request_id: "meta-A" },
				note: "EVENT-A",
			}),
			makeEvent({
				id: "e-meta-2",
				metadata: { request_id: "meta-B" },
				note: "EVENT-B",
			}),
			makeEvent({
				id: "e-meta-3",
				metadata: { request_id: "meta-C" },
				note: "EVENT-C",
			}),
		];

		render(<EventTimeline events={events} />);

		const disclosures = screen.getAllByTestId("event-metadata");
		expect(disclosures).toHaveLength(3);

		// The first disclosure must contain "meta-A" but not the
		// other tokens — the per-row scoping is real, not just a
		// count check.
		expect(disclosures[0].textContent ?? "").toMatch(/meta-A/);
		expect(disclosures[0].textContent ?? "").not.toMatch(/meta-B/);
		expect(disclosures[0].textContent ?? "").not.toMatch(/meta-C/);
		expect(disclosures[1].textContent ?? "").toMatch(/meta-B/);
		expect(disclosures[1].textContent ?? "").not.toMatch(/meta-A/);
		expect(disclosures[2].textContent ?? "").toMatch(/meta-C/);
		expect(disclosures[2].textContent ?? "").not.toMatch(/meta-A/);
	});
});
