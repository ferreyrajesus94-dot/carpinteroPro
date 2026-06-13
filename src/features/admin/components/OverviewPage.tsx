import { useState } from "react";
import { useAdminOverview } from "../hooks/useAdminOverview";
import { useToggleMaintenance } from "../hooks/useAdminActions";
import { cn } from "@/shared/lib/utils";

const STATUS_LABELS: Record<string, string> = {
	active: "activas",
	inactive: "inactivas",
	cancelled: "canceladas",
	paused: "pausadas",
	past_due: "vencidas",
	trial: "en prueba",
};

function statusLabel(status: string): string {
	return STATUS_LABELS[status] ?? status;
}

function OverviewSkeleton() {
	return (
		<div
			role="status"
			aria-label="Cargando resumen de plataforma"
			className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
		>
			{Array.from({ length: 4 }).map((_, i) => (
				<div
					key={i}
					className="animate-pulse rounded-xl border border-line bg-cp-surface p-5"
				>
					<div className="mb-3 h-3 w-20 rounded bg-cp-bg2" />
					<div className="h-7 w-12 rounded bg-cp-bg2" />
				</div>
			))}
		</div>
	);
}

interface KpiCardProps {
	label: string;
	value: number;
	icon: string;
	variant?: "default" | "warning";
}

function KpiCard({ label, value, icon, variant = "default" }: KpiCardProps) {
	return (
		<article
			className={cn(
				"rounded-xl border p-5 shadow-sm",
				variant === "warning"
					? "border-amber-200 bg-amber-50"
					: "border-line bg-cp-surface",
			)}
		>
			<div className="flex items-start justify-between">
				<div>
					<p className="text-xs font-medium uppercase tracking-wider text-ink3">
						{label}
					</p>
					<p
						className={cn(
							"mt-1 font-mono text-3xl font-bold tracking-tight",
							variant === "warning" ? "text-amber-700" : "text-ink",
						)}
					>
						{value}
					</p>
				</div>
				<i
					className={`fi ${icon} text-2xl leading-none ${
					variant === "warning" ? "text-amber-600" : "text-cp-accent"
				}`}
					aria-hidden="true"
				/>
			</div>
		</article>
	);
}

export function OverviewPage() {
	const overview = useAdminOverview();
	const maintenanceMutation = useToggleMaintenance();
	const [maintMessage, setMaintMessage] = useState("");
	const lastUpdated = overview.dataUpdatedAt
		? new Date(overview.dataUpdatedAt).toLocaleTimeString("es-AR", {
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;

	if (overview.isPending) return <OverviewSkeleton />;

	if (overview.isError) {
		return (
			<section
				role="alert"
				aria-label="Error al cargar el resumen"
				className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
			>
				<i
					className="fi fi-rr-exclamation-circle mb-3 block text-2xl text-destructive"
					aria-hidden="true"
				/>
				<h2 className="font-display text-lg font-semibold text-ink">
					No se pudo cargar el resumen
				</h2>
				<p className="mt-1 text-sm text-ink2">
					{overview.error instanceof Error
						? overview.error.message
						: "Error desconocido"}
				</p>
			</section>
		);
	}

	const data = overview.data;

	if (!data) {
		return (
			<section className="rounded-xl border border-line bg-cp-surface p-6 text-center">
				<p className="text-sm text-ink2">Sin datos disponibles</p>
			</section>
		);
	}

	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-baseline justify-between gap-2">
				<div>
					<h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
						Resumen de plataforma
					</h1>
					<p className="mt-1 text-sm text-ink2">
						Indicadores globales de CarpinteroPro
					</p>
				</div>
				{lastUpdated && (
					<p className="text-xs text-ink3">
						Actualizado {lastUpdated}
					</p>
				)}
			</header>

			<section
				className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
				role="region"
				aria-label="Indicadores de plataforma"
			>
				<KpiCard
					label="Talleres totales"
					value={data.workshops.total}
					icon="fi-rr-building"
				/>
				<KpiCard
					label="Nuevos (30 días)"
					value={data.workshops.createdLast30Days}
					icon="fi-rr-stars"
				/>
				<KpiCard
					label="Suscripciones"
					value={data.subscriptions.total}
					icon="fi-rr-credit-card"
				/>
				<KpiCard
					label="Fallos webhook"
					value={data.support.recentWebhookFailures}
					icon="fi-rr-triangle-warning"
					variant={
						data.support.recentWebhookFailures > 0 ? "warning" : "default"
					}
				/>
			</section>

			{data.support.recentWebhookFailures > 0 && (
				<div
					role="status"
					aria-label="Alerta de webhook"
					className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
				>
					<i
						className="fi fi-rr-bell-ring mr-2 align-middle"
						aria-hidden="true"
					/>
					{data.support.recentWebhookFailures} errores de webhook en los últimos
					100 eventos. Revisar MercadoPago.
				</div>
			)}

			<section
				className="rounded-xl border border-line bg-cp-surface p-5 shadow-sm"
				role="region"
				aria-label="Suscripciones por estado"
			>
				<h3 className="font-display text-base font-semibold text-ink">
					Suscripciones por estado
				</h3>
				{Object.keys(data.subscriptions.byStatus).length === 0 ? (
					<p className="mt-2 text-sm text-ink2">
						No hay suscripciones registradas
					</p>
				) : (
					<div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{Object.entries(data.subscriptions.byStatus).map(
							([status, count]) => {
								const isActive = status === "active" || status === "trial";
								const isWarning = status === "paused" || status === "past_due";
								return (
									<div
										key={status}
										className={cn(
											"flex items-center justify-between rounded-lg border px-4 py-3",
											isActive &&
												"border-emerald-200 bg-emerald-50",
											isWarning &&
												"border-amber-200 bg-amber-50",
											!isActive &&
												!isWarning &&
												"border-red-200 bg-red-50",
										)}
									>
										<span
											className={cn(
												"text-sm font-medium capitalize",
												isActive && "text-emerald-800",
												isWarning && "text-amber-800",
												!isActive && !isWarning && "text-red-800",
											)}
										>
											{statusLabel(status)}
										</span>
										<span
											className={cn(
												"font-mono text-lg font-bold",
												isActive && "text-emerald-800",
												isWarning && "text-amber-800",
												!isActive && !isWarning && "text-red-800",
											)}
										>
											{count}
										</span>
									</div>
								);
							},
						)}
					</div>
				)}
			</section>

			<section className="rounded-xl border border-line bg-cp-surface p-5 shadow-sm">
				<h3 className="font-display text-base font-semibold text-ink">
					Modo mantenimiento
				</h3>
				<p className="mt-1 text-sm text-ink2">
					Mostrar un banner a todos los usuarios no-admin
				</p>
				<div className="mt-3 flex flex-wrap items-center gap-3">
					<input
						type="text"
						placeholder="Mensaje de mantenimiento..."
						value={maintMessage}
						onChange={(e) => setMaintMessage(e.target.value)}
						className="h-9 flex-1 rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
					/>
					<button
						type="button"
						onClick={() =>
							maintenanceMutation.mutate({
								enabled: true,
								message: maintMessage || undefined,
							})
						}
						className="inline-flex h-9 items-center gap-1.5 rounded-md bg-amber-100 px-4 text-xs font-medium text-amber-800 hover:bg-amber-200 transition-colors"
					>
						Activar
					</button>
					<button
						type="button"
						onClick={() => maintenanceMutation.mutate({ enabled: false })}
						className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-100 px-4 text-xs font-medium text-emerald-800 hover:bg-emerald-200 transition-colors"
					>
						Desactivar
					</button>
				</div>
			</section>
		</div>
	);
}
