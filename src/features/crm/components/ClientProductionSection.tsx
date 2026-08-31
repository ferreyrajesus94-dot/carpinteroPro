import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useProductionOrders } from "@/features/production/hooks/useProductionOrders";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import {
	PRODUCTION_ORDER_STATE_LABELS,
	PRODUCTION_ORDER_STATE,
	type ProductionOrderState,
} from "@/features/production/api/types";
import { Loader2 } from "lucide-react";

interface ClientProductionSectionProps {
	/** Quote IDs that belong to the current client. Used to filter
	 *  the workshop-wide production orders down to the ones that
	 *  matter for this client's profile. */
	quoteIds: string[];
}

/**
 * Per-client production history. We pull the workshop-wide
 * `useProductionOrders()` cache (which is already warm after the
 * production board was visited in the same session) and filter
 * client-side by `quoteId`. This avoids an N+1 query per quote
 * without needing a new server-side RPC.
 */
export function ClientProductionSection({ quoteIds }: ClientProductionSectionProps) {
	const workshopId = useWorkshopId();
	const { data: orders = [], isLoading } = useProductionOrders({});

	const clientOrders = useMemo(() => {
		if (quoteIds.length === 0) return [];
		const ids = new Set(quoteIds);
		return orders.filter((o) => ids.has(o.quote_id));
	}, [orders, quoteIds]);

	if (isLoading) {
		return (
			<div className="rounded-xl border border-line bg-surface p-4 md:p-5">
				<h2 className="font-display text-[14px] font-semibold text-ink mb-3">
					Producción
				</h2>
				<div className="flex items-center gap-2 py-2 text-sm text-ink3">
					<Loader2 className="h-4 w-4 animate-spin" />
					Cargando producción...
				</div>
			</div>
		);
	}

	if (clientOrders.length === 0) {
		return (
			<div className="rounded-xl border border-line bg-surface p-4 md:p-5">
				<h2 className="font-display text-[14px] font-semibold text-ink mb-3">
					Producción
				</h2>
				<p className="py-6 text-center text-[12px] text-ink3">
					Este cliente no tiene muebles en producción.
				</p>
			</div>
		);
	}

	// Sort: most recently updated first.
	const sorted = [...clientOrders].sort((a, b) =>
		(b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
	);

	return (
		<div
			data-testid="client-production-section"
			className="rounded-xl border border-line bg-surface p-4 md:p-5"
		>
			<h2 className="font-display text-[14px] font-semibold text-ink mb-3">
				Producción
			</h2>
			<div className="space-y-2">
				{sorted.map((o) => {
					const stateLabel =
						PRODUCTION_ORDER_STATE_LABELS[o.state as ProductionOrderState] ??
						String(o.state);
					return (
						<Link
							key={o.id}
							to={`/production/${o.id}`}
							data-testid={`client-production-link-${o.state}`}
							className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 transition-colors hover:border-line2 hover:bg-cp-bg2"
						>
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<span className="font-mono text-[11px] text-ink3">
										{o.production_number}
									</span>
									<StateBadge state={o.state} />
								</div>
								<div className="mt-0.5 truncate font-medium text-[13.5px] text-ink">
									{o.quote_furniture_name}
								</div>
							</div>
							<div className="shrink-0 text-[12px] text-ink2">
								{stateLabel}
							</div>
						</Link>
					);
				})}
			</div>
		</div>
	);
}

/**
 * Compact state badge that uses the same colour semantics as the
 * production board. Kept inline because the production feature does
 * not export a generic state badge component yet; once it does we can
 * replace this with the shared one.
 */
function StateBadge({ state }: { state: string }) {
	const isTerminal =
		state === PRODUCTION_ORDER_STATE.DELIVERED ||
		state === PRODUCTION_ORDER_STATE.CANCELLED;
	const palette = isTerminal
		? "bg-cp-bg2 text-ink3"
		: "bg-cp-accent-soft text-cp-accent";
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${palette}`}
		>
			{PRODUCTION_ORDER_STATE_LABELS[state as ProductionOrderState] ?? state}
		</span>
	);
}