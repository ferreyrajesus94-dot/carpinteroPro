import { ArrowRight, Check, Pause, Play, Plus, X } from "lucide-react";
import type { ProductionOrderEvent } from "../api/productionOrders";
import {
	PRODUCTION_ORDER_STATE,
	PRODUCTION_ORDER_STATE_LABELS,
	type ProductionOrderState,
} from "../api/types";
import {
	EVENT_TYPE_ICONS,
	isTerminalEventKind,
	resolveEventTypeFromColumn,
	resolveEventTypeLabel,
} from "../lib/eventLabels";

/**
 * EventTimeline — read-only vertical timeline of the append-only
 * `production_order_events` rows for a production order.
 *
 * Contract:
 *
 * - The events MUST arrive in the order returned by
 *   `get_production_order_events` (i.e. `created_at ASC, id ASC`).
 *   The component does NOT re-sort. Re-sorting client-side would lose
 *   the SQL tie-breaker and could break the deterministic ordering
 *   guarantee from PR 3.
 * - Each row shows the resolved event-type label, the
 *   from_state -> to_state transition (when applicable), the actor
 *   name, the human note, and a metadata disclosure.
 * - The event-type label is the SQL-provided `event_type` column
 *   (PR 7), with a state-derived fallback. The human note is the
 *   SQL-provided `note` column (PR 7), with a `reason` fallback for
 *   back-compat with pre-PR 7 data.
 * - The empty state is rendered as a Spanish empty-state copy so the
 *   detail page never shows a "blank" timeline.
 *
 * The timeline is a presentational component: it does not fetch. The
 * detail page wires the `useProductionOrderEvents` hook and passes the
 * result here.
 */

const ICON_BY_NAME = {
	Plus,
	ArrowRight,
	Play,
	Pause,
	X,
	Check,
} as const;

const FALLBACK_ACTOR_LABEL = "Sistema";

function formatTransition(
	fromState: ProductionOrderState | null,
	toState: ProductionOrderState,
): string {
	if (fromState === null) {
		return PRODUCTION_ORDER_STATE_LABELS[toState];
	}
	return `${PRODUCTION_ORDER_STATE_LABELS[fromState]} → ${PRODUCTION_ORDER_STATE_LABELS[toState]}`;
}

function formatCreatedAt(iso: string): string {
	// The RPC returns timestamptz as ISO with Z. We render a short,
	// locale-agnostic dd/mm/yyyy hh:mm so the order of entries is
	// visible without dragging in `date-fns` formatting.
	const match = iso.match(
		/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
	);
	if (!match) return iso;
	const [, year, month, day, hour, minute] = match;
	return `${day}/${month}/${year} ${hour}:${minute}`;
}

function formatMetadata(metadata: unknown): string {
	if (metadata == null) return "";
	if (typeof metadata !== "object") return String(metadata);
	try {
		return JSON.stringify(metadata);
	} catch {
		return "";
	}
}

/**
 * Resolve the human note text for a row, preferring the PR 7 `note`
 * column and falling back to the legacy `reason` column. The two
 * columns carry the same value for new rows (the write RPCs populate
 * both); the fallback exists so a row from before PR 7 — or a row
 * that pre-dates the migration — still renders the human note.
 */
function resolveEventNote(event: ProductionOrderEvent): string | null {
	if (event.note && event.note.trim().length > 0) return event.note;
	if (event.reason && event.reason.trim().length > 0) return event.reason;
	return null;
}

export interface EventTimelineProps {
	events: ProductionOrderEvent[];
}

export function EventTimeline({ events }: EventTimelineProps) {
	if (events.length === 0) {
		return (
			<p
				data-testid="event-timeline-empty"
				className="text-sm text-ink3"
			>
				Aún no hay eventos registrados para esta orden.
			</p>
		);
	}

	return (
		<ol
			data-testid="event-timeline"
			className="flex flex-col gap-3"
			aria-label="Cronología de la orden"
		>
			{events.map((event) => {
				// PR 7: prefer the SQL-provided event_type column; fall
				// back to the (from_state, to_state)-derived label when
				// the column is missing or unrecognized (e.g. pre-PR 7
				// data, or a future kind the client hasn't been
				// updated for).
				const kind = resolveEventTypeFromColumn(
					event.event_type,
					event.from_state as ProductionOrderState | null,
					event.to_state as ProductionOrderState,
				);
				const Icon =
					ICON_BY_NAME[
						EVENT_TYPE_ICONS[kind] as keyof typeof ICON_BY_NAME
					];
				const terminal = isTerminalEventKind(kind);
				const actorLabel = event.actor_name?.trim()
					? event.actor_name
					: FALLBACK_ACTOR_LABEL;
				const metadata = formatMetadata(event.metadata);
				const note = resolveEventNote(event);

				return (
					<li
						key={event.id}
						data-testid="event-timeline-item"
						className="flex items-start gap-3 rounded-md border border-line bg-background p-3"
					>
						<span
							aria-hidden="true"
							className={
								"mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full " +
								(terminal
									? "bg-cp-danger/10 text-cp-danger"
									: "bg-cp-accent-soft text-cp-accent")
							}
						>
							<Icon className="h-4 w-4" />
						</span>
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<div className="flex flex-wrap items-baseline gap-2">
								<span
									data-testid="event-timeline-label"
									className="text-sm font-medium text-ink"
								>
									{resolveEventTypeLabel(kind)}
								</span>
								<span className="text-xs text-ink3">
									{formatTransition(
										event.from_state as ProductionOrderState | null,
										event.to_state as ProductionOrderState,
									)}
								</span>
							</div>
							<p className="text-xs text-ink2">
								{formatCreatedAt(event.created_at)} · {actorLabel}
							</p>
							{note ? (
								<p
									data-testid="event-timeline-note"
									className="text-sm text-ink2"
								>
									{note}
								</p>
							) : null}
							{metadata ? (
								<details
									data-testid="event-metadata"
									className="mt-1 text-xs text-ink3"
								>
									<summary className="cursor-pointer select-none">
										Detalle técnico
									</summary>
									<pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] text-ink3">
										{metadata}
									</pre>
								</details>
							) : null}
						</div>
					</li>
				);
			})}
		</ol>
	);
}

// (no additional exports)
