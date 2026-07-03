import { useProductionPipelineStats } from "../hooks/useProductionOrders";
import { PRODUCTION_ORDER_ACTIVE_STATES } from "../api/types";
import type { ProductionOrderState } from "../api/types";
import type { ProductionPipelineStat } from "../api/productionOrders";

/**
 * Pipeline-state label map for the dashboard widget. Mirrors the active
 * states the production board uses; the two terminal states are
 * intentionally excluded from this widget.
 */
const ACTIVE_STATE_LABELS: Record<ProductionOrderState, string> = {
	planned: "Planificado",
	in_progress: "En producción",
	paused: "Pausado",
	quality_check: "Control de calidad",
	ready: "Listo",
	delivered: "Entregado",
	cancelled: "Cancelado",
};

/**
 * Tailwind utility class for the per-state swatch color. These are
 * presentational-only and live in the same chip-color family the rest
 * of the dashboard uses; the widget does not import any state-specific
 * tokens from the production feature to keep this file self-contained.
 */
const ACTIVE_STATE_SWATCH_BG: Record<ProductionOrderState, string> = {
	planned: "bg-cp-accent-soft",
	in_progress: "bg-cp-accent",
	paused: "bg-amber-400",
	quality_check: "bg-violet-400",
	ready: "bg-emerald-500",
	delivered: "bg-emerald-700",
	cancelled: "bg-rose-400",
};

function getCountForState(
	stats: ProductionPipelineStat[] | undefined,
	state: ProductionOrderState,
): number {
	if (!stats) return 0;
	const match = stats.find((s) => s.state === state);
	return match?.count ?? 0;
}

/**
 * Production pipeline widget for the home dashboard.
 *
 * Reads `get_production_pipeline_stats` via the `useProductionPipelineStats`
 * hook (a TanStack Query wrapper around the SECURITY INVOKER read RPC).
 * Renders one swatch per active state plus a total count, excluding the
 * two terminal states (delivered, cancelled).
 *
 * The widget is owned by the production feature so the dashboard (and
 * any future surface) can mount it without crossing the
 * `featureZone("production")` ESLint boundary. It is re-exported from
 * `src/features/production/index.ts`.
 *
 * Cache privacy: this widget does not introduce any new query key.
 * It uses `useProductionPipelineStats` whose key
 * `["production_orders", "pipeline"]` is asserted as non-persistable
 * by `useProductionOrders.cachePrivacy.test.ts` against the real
 * `@/shared/lib/cachePrivacy` policy. A widget-level RLS/cache-privacy
 * sanity test lives in `ProductionPipelineWidget.cachePrivacy.test.tsx`.
 */
export function ProductionPipelineWidget() {
	const { data, isLoading, isError } = useProductionPipelineStats();

	const total = PRODUCTION_ORDER_ACTIVE_STATES.reduce(
		(sum, state) => sum + getCountForState(data, state),
		0,
	);

	if (isLoading) {
		return (
			<div
				data-testid="pipeline-widget-loading"
				className="rounded-xl border border-line bg-surface p-4"
				role="status"
				aria-label="Cargando pipeline de producción"
			>
				<p className="text-[10.5px] uppercase tracking-[0.08em] text-ink3 font-medium mb-3">
					Pipeline de producción
				</p>
				<div className="h-3 w-32 animate-pulse rounded bg-cp-bg2" />
			</div>
		);
	}

	if (isError) {
		return (
			<div
				data-testid="pipeline-widget-error"
				className="rounded-xl border border-rose-300 bg-rose-50 p-4"
				role="alert"
			>
				<p className="text-[10.5px] uppercase tracking-[0.08em] text-rose-700 font-medium mb-1">
					Pipeline de producción
				</p>
				<p className="text-[12px] text-rose-800">
					No se pudo cargar el pipeline. Reintentá desde esta pantalla.
				</p>
			</div>
		);
	}

	return (
		<div
			data-testid="pipeline-widget"
			className="rounded-xl border border-line bg-surface p-4"
		>
			<header className="mb-3 flex items-baseline justify-between">
				<h2 className="text-[10.5px] uppercase tracking-[0.08em] text-ink3 font-medium">
					Pipeline de producción
				</h2>
				<p className="font-mono text-[12px] text-ink2">
					<span data-testid="pipeline-total">{total}</span>{" "}
					<span className="text-ink3">activas</span>
				</p>
			</header>

			<ul
				data-testid="pipeline-swatches"
				className="flex items-center gap-1.5"
				aria-label="Órdenes activas por estado"
			>
				{PRODUCTION_ORDER_ACTIVE_STATES.map((state) => {
					const count = getCountForState(data, state);
					return (
						<li
							key={state}
							data-testid="pipeline-swatch"
							data-state={state}
							className="flex min-w-0 flex-1 flex-col items-center gap-1"
						>
							<span
								aria-hidden="true"
								className={`block h-2 w-full rounded-full ${ACTIVE_STATE_SWATCH_BG[state]}`}
							/>
							<span className="text-[9.5px] uppercase tracking-wide text-ink3 truncate w-full text-center">
								{ACTIVE_STATE_LABELS[state]}
							</span>
							<span
								data-testid={`pipeline-swatch-count-${state}`}
								className="font-mono text-[12px] font-semibold text-ink"
							>
								{count}
							</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
