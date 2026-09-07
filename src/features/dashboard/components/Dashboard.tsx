import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
	AlertTriangle,
	Clock,
	FileText,
	Package,
	Armchair,
	Users,
} from "lucide-react";
import { formatCurrency } from "@/shared/lib/formatters";
import { QUOTE_STATUS_LABELS } from "@/shared/types/quotes";
import { Button } from "@/shared/ui/button";
import { ChipToggle } from "@/shared/ui/chip-toggle";
import { PageHeader } from "@/shared/ui/page-header";
import { SectionHowto } from "@/shared/ui/section-howto";
import { Eyebrow } from "@/shared/ui/eyebrow";
import { KPICards } from "./KPICards";
import { RevenueChart } from "./RevenueChart";
import { ActiveQuotesPanel } from "./ActiveQuotesPanel";
import { useDashboardStats, type Period } from "../hooks/useDashboardStats";
import type { DashboardMaterial, DashboardQuote } from "../types";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
	{ value: "current_month", label: "Mes actual" },
	{ value: "last_month", label: "Mes anterior" },
	{ value: "last_3_months", label: "Últimos 3 meses" },
];

const ALL_STATUSES = [
	"presupuesto",
	"enviado",
	"aprobado",
	"en_produccion",
	"entregado",
	"cancelado",
] as const;

// Business rules for the "stale quote" indicator on the dashboard.
// Centralized so the copy at the rendering site stays in sync with the
// numeric threshold and the re-evaluation interval.
const MS_PER_DAY = 86_400_000;
const STALE_QUOTE_DAYS = 5;
const STALE_QUOTE_RECHECK_INTERVAL_MS = 60_000;

export interface DashboardProps {
	quotes: DashboardQuote[];
	materials: DashboardMaterial[];
	isLoading: boolean;
	quotesError: boolean;
	materialsError: boolean;
	quotesRefetch: () => void;
	materialsRefetch: () => void;
	productionPipelineWidget: ReactNode;
}

export function Dashboard({
	quotes,
	materials,
	isLoading,
	quotesError,
	materialsError,
	quotesRefetch,
	materialsRefetch,
	productionPipelineWidget,
}: DashboardProps) {
	const navigate = useNavigate();
	const [period, setPeriod] = useState<Period>("current_month");
	const [staleQuotes, setStaleQuotes] = useState<typeof quotes>([]);
	const stats = useDashboardStats(quotes, period);

	useEffect(() => {
		function updateStaleQuotes() {
			const currentTime = Date.now();
			setStaleQuotes(
				quotes.filter((q) => {
					if (q.status !== "enviado") return false;
					const diffDays =
						(currentTime - new Date(q.created_at).getTime()) / MS_PER_DAY;
					return diffDays > STALE_QUOTE_DAYS;
				}),
			);
		}

		const timeoutId = window.setTimeout(updateStaleQuotes, 0);
		const intervalId = window.setInterval(
			updateStaleQuotes,
			STALE_QUOTE_RECHECK_INTERVAL_MS,
		);
		return () => {
			window.clearTimeout(timeoutId);
			window.clearInterval(intervalId);
		};
	}, [quotes]);

	const lowStockMaterials = materials.filter((m) => m.stock <= m.min_stock);

	const totalDist = stats.byStatus.reduce((a, b) => a + b.count, 0);

	if (isLoading) {
		return (
			<div className="space-y-4 p-4 md:p-6">
				{[...Array(4)].map((_, i) => (
					<div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
				))}
				{productionPipelineWidget}
			</div>
		);
	}

	if (quotesError || materialsError) {
		const both = quotesError && materialsError;
		return (
			<div className="pb-24 md:pb-6 space-y-3 p-4 md:p-6 min-w-0">
				<div
					role="alert"
					className="rounded-md border border-cp-danger/30 bg-cp-danger/10 p-3 flex items-center justify-between gap-3"
				>
					<p className="text-sm text-cp-danger">
						{both
							? "No se pudieron cargar los presupuestos ni el inventario. Reintentá."
							: quotesError
								? "No se pudieron cargar los presupuestos. Reintentá."
								: "No se pudo cargar el inventario. Reintentá."}
					</p>
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							if (quotesError) quotesRefetch();
							if (materialsError) materialsRefetch();
						}}
					>
						Reintentar
					</Button>
				</div>
				{productionPipelineWidget}
			</div>
		);
	}

	const maxRev = Math.max(...stats.revenueByMonth.map((d) => d.total), 1);

	return (
		<div className="pb-24 md:pb-6 space-y-5 p-4 md:p-6 min-w-0">
			<PageHeader
				title="Inicio"
				actions={
					<div role="radiogroup" aria-label="Período de facturación">
						<div className="flex rounded-lg border border-line bg-cp-bg2 p-1 gap-1">
							{PERIOD_OPTIONS.map((opt) => (
								<span
									key={opt.value}
									role="radio"
									aria-checked={period === opt.value}
								>
									<ChipToggle
										variant="tab"
										active={period === opt.value}
										onSelect={() => setPeriod(opt.value)}
										label={opt.label}
										ariaLabel={opt.label}
									/>
								</span>
							))}
						</div>
					</div>
				}
			/>

			<SectionHowto
				storageKey="dashboard"
				steps={[
					"En esta pantalla ves los números clave: facturación, presupuestos, conversión.",
					"Tocá una tarjeta para ir al detalle de esa sección.",
					"El gráfico compara los últimos 12 meses de ingresos aprobados.",
				]}
			/>

			{/* Hero KPI — facturación del período */}
			<div className="rounded-xl border border-line bg-cp-surface overflow-hidden">
				<div className="p-4 pb-3">
					<div className="flex items-center justify-between">
						<Eyebrow as="div" variant="mono" className="text-[10.5px] tracking-[0.1em]">
							Facturado —{" "}
							{PERIOD_OPTIONS.find((o) => o.value === period)?.label}
						</Eyebrow>
					</div>
					{/* Hero KPI — display voice exception.
					    Money Is Mono Rule still binds: tables, lists, and the
					    "ticket promedio" sub-label below stay in JetBrains Mono.
					    The 40px hero carries the day's headline, not a ledger
					    entry, so it lifts to Fraunces italic per the brand brief. */}
					<div className="mt-2 font-display italic font-semibold text-[40px] leading-none text-ink">
						{formatCurrency(stats.totalRevenue)}
					</div>
					<div className="mt-1 text-[12px] text-ink3">
						{stats.quoteCount} presupuesto{stats.quoteCount !== 1 ? "s" : ""}{" "}
						emitido{stats.quoteCount !== 1 ? "s" : ""} · ticket promedio{" "}
						{formatCurrency(stats.averageTicket)}
					</div>
				</div>
				{/* Mini bar chart */}
				<div className="px-4 pb-4">
					<div className="flex items-end gap-1.5 h-16">
						{stats.revenueByMonth.map((d, i) => {
							const isLast = i === stats.revenueByMonth.length - 1;
							return (
								<div
									key={i}
									className="flex-1 flex flex-col items-center gap-1"
								>
									<div
										className="w-full rounded-[3px] transition-all"
										style={{
											height: `${Math.max((d.total / maxRev) * 100, 4)}%`,
											background: isLast ? "var(--cp-accent)" : "var(--line-2)",
										}}
									/>
									<span
										className={`text-[9px] font-mono ${isLast ? "text-cp-accent font-semibold" : "text-ink3"}`}
									>
										{d.month}
									</span>
								</div>
							);
						})}
					</div>
				</div>
				{/* Progress bar */}
				<div
					className="h-1 bg-cp-accent opacity-70"
					style={{ width: `${Math.min(stats.conversionRate, 100)}%` }}
				/>
			</div>

			{/* KPI grid 2×2 mobile / 4×1 desktop */}
			<KPICards stats={stats} />

			{productionPipelineWidget}

			{/* Pipeline snapshot */}
			{stats.byStatus.length > 0 && (
				<div className="rounded-xl border border-line bg-cp-surface p-4">
					<Eyebrow as="p" variant="mono" className="text-[10.5px] mb-3">
						Pipeline · presupuestos activos
					</Eyebrow>
					<div className="space-y-2">
						{ALL_STATUSES.map((status) => {
							const entry = stats.byStatus.find((s) => s.status === status);
							if (!entry) return null;
							const pct =
								totalDist > 0 ? Math.round((entry.count / totalDist) * 100) : 0;
							return (
								<div key={status} className="flex items-center gap-3">
									<div className="w-28 shrink-0">
										<span
											className={`chip-${status} inline-flex items-center gap-1 rounded-full text-[11px] px-2 py-0.5 font-medium`}
										>
											<span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
											{QUOTE_STATUS_LABELS[status]}
										</span>
									</div>
									<div className="flex-1 h-2 rounded-full bg-cp-bg2 overflow-hidden">
										<div
											className="h-full rounded-full bg-cp-accent"
											style={{ width: `${pct}%` }}
										/>
									</div>
									<div className="font-mono text-[12px] text-ink2 w-6 text-right">
										{entry.count}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Shortcuts */}
			<div>
				<Eyebrow as="p" variant="mono" className="text-[10.5px] mb-2">
					Accesos rápidos
				</Eyebrow>
				<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
					{[
						{
							icon: FileText,
							title: "Nuevo presupuesto",
							hint: "En 4 pasos",
							path: "/quotes/new",
						},
						{
							icon: Package,
							title: "Ajustar stock",
							hint: "Entrada / salida",
							path: "/inventory",
						},
						{
							icon: Armchair,
							title: "Crear mueble",
							hint: "Plantilla BOM",
							path: "/recipes/new",
						},
						{
							icon: Users,
							title: "Alta cliente",
							hint: "Con contacto",
							path: "/crm",
						},
					].map((s) => (
						<button
							key={s.path}
							onClick={() => navigate(s.path)}
							className="text-left bg-cp-surface border border-line rounded-xl p-3 hover:border-line2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cp-bg"
						>
							<div className="flex items-center justify-between">
								<div className="w-8 h-8 rounded-md bg-cp-accent-soft text-cp-accent grid place-items-center">
									<s.icon size={16} />
								</div>
							</div>
							<div className="mt-2 font-display font-semibold text-[14px] text-ink">
								{s.title}
							</div>
							<div className="text-[11px] text-ink3">{s.hint}</div>
						</button>
					))}
				</div>
			</div>

			{/* Needs attention */}
			{(lowStockMaterials.length > 0 || staleQuotes.length > 0) && (
				<div>
					<Eyebrow as="p" variant="mono" className="text-[10.5px] mb-2">
						Requiere atención
					</Eyebrow>
					<div className="space-y-2">
						{lowStockMaterials.length > 0 && (
							<div
								className="bg-cp-surface border border-line rounded-xl p-3 flex items-start gap-3"
								style={{
									borderLeftWidth: 4,
									borderLeftColor: "var(--cp-warn)",
								}}
							>
								<AlertTriangle
									size={16}
									className="mt-0.5 shrink-0"
									style={{ color: "var(--cp-warn)" }}
								/>
								<div className="flex-1 min-w-0">
									<div className="font-medium text-[13.5px] text-ink">
										{lowStockMaterials.length} material
										{lowStockMaterials.length !== 1 ? "es" : ""} en stock bajo
									</div>
									<div className="text-[12px] text-ink3 truncate">
										{lowStockMaterials
											.slice(0, 3)
											.map((m) => m.name)
											.join(" · ")}
									</div>
								</div>
								<Button
									variant="ghost"
									size="default"
									onClick={() => navigate("/inventory")}
									className="shrink-0"
								>
									Ver
								</Button>
							</div>
						)}
						{staleQuotes.length > 0 && (
							<div className="bg-cp-surface border border-line rounded-xl p-3 flex items-start gap-3">
								<Clock size={16} className="mt-0.5 text-ink2 shrink-0" />
								<div className="flex-1 min-w-0">
									<div className="font-medium text-[13.5px] text-ink">
										{staleQuotes.length} presupuesto
										{staleQuotes.length !== 1 ? "s" : ""} sin respuesta hace más
										de {STALE_QUOTE_DAYS} días
									</div>
									<div className="text-[12px] text-ink3">
										Enviá un recordatorio por WhatsApp
									</div>
								</div>
								<Button
									variant="ghost"
									size="default"
									onClick={() => navigate("/quotes")}
									className="shrink-0"
								>
									Ver
								</Button>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Revenue chart — desktop bonus */}
			<div className="hidden lg:grid lg:grid-cols-3 gap-4">
				<div className="lg:col-span-2">
					<RevenueChart data={stats.revenueByMonth} />
				</div>
				<ActiveQuotesPanel quotes={stats.activeQuotes} />
			</div>

			{/* Active quotes — mobile */}
			<div className="lg:hidden">
				<ActiveQuotesPanel quotes={stats.activeQuotes} />
			</div>
		</div>
	);
}
