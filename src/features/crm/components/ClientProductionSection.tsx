import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Minimal shape the CRM feature needs to render a production-order
 * link for the client. The host page (CrmClientDetailPage in
 * `src/app/`) is responsible for pre-computing the human-readable
 * `stateLabel` and the `isTerminal` flag from the production
 * feature's state machine, so this component stays inside the CRM
 * feature zone — no cross-feature import required.
 */
export interface ClientProductionOrderItem {
	id: string;
	productionNumber: string;
	quoteFurnitureName: string;
	state: string;
	stateLabel: string;
	isTerminal: boolean;
}

interface ClientProductionSectionProps {
	orders: ClientProductionOrderItem[];
}

export function ClientProductionSection({ orders }: ClientProductionSectionProps) {
	if (orders.length === 0) {
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

	return (
		<div
			data-testid="client-production-section"
			className="rounded-xl border border-line bg-surface p-4 md:p-5"
		>
			<h2 className="font-display text-[14px] font-semibold text-ink mb-3">
				Producción
			</h2>
			<div className="space-y-2">
				{orders.map((o) => (
					<Link
						key={o.id}
						to={`/production/${o.id}`}
						data-testid={`client-production-link-${o.state}`}
						className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 transition-colors hover:border-line2 hover:bg-cp-bg2"
					>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<span className="font-mono text-[11px] text-ink3">
									{o.productionNumber}
								</span>
								<StateBadge state={o.state} label={o.stateLabel} isTerminal={o.isTerminal} />
							</div>
							<div className="mt-0.5 truncate font-medium text-[13.5px] text-ink">
								{o.quoteFurnitureName}
							</div>
						</div>
						<div className="shrink-0 text-[12px] text-ink2">
							{o.stateLabel}
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}

function StateBadge({
	state,
	label,
	isTerminal,
}: {
	state: string;
	label: string;
	isTerminal: boolean;
}) {
	const palette = isTerminal
		? "bg-cp-bg2 text-ink3"
		: "bg-cp-accent-soft text-cp-accent";
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${palette}`}
			data-state={state}
		>
			{label}
		</span>
	);
}

/** Re-export so other feature code that imports this file can still
 *  check the loading state without a separate import. */
export function ClientProductionSectionLoading() {
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