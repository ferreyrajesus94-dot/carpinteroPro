import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminSubscriptions } from "../hooks/useAdminSubscriptions";
import { cn } from "@/shared/lib/utils";

const STATUS_LABELS: Record<string, string> = {
	active: "activa",
	inactive: "inactiva",
	cancelled: "cancelada",
	paused: "pausada",
	past_due: "vencida",
	trial: "en prueba",
};

const STATUS_OPTIONS = [
	{ value: "", label: "Todos los estados" },
	{ value: "active", label: "Activas" },
	{ value: "cancelled", label: "Canceladas" },
	{ value: "paused", label: "Pausadas" },
	{ value: "past_due", label: "Vencidas" },
	{ value: "trial", label: "En prueba" },
];

function statusBadge(status: string) {
	return (
		<span
			className={cn(
				"rounded-full px-2.5 py-0.5 text-[11px] font-medium",
				status === "active" || status === "trial"
					? "bg-emerald-100 text-emerald-700"
					: status === "paused"
						? "bg-amber-100 text-amber-700"
						: "bg-red-100 text-red-700",
			)}
		>
			{STATUS_LABELS[status] ?? status}
		</span>
	);
}

function BillingSkeleton() {
	return (
		<div
			role="status"
			aria-label="Cargando suscripciones"
			className="space-y-3"
		>
			{Array.from({ length: 4 }).map((_, i) => (
				<div
					key={i}
					className="animate-pulse rounded-lg border border-line bg-cp-surface p-4"
				>
					<div className="mb-2 h-4 w-32 rounded bg-cp-bg2" />
					<div className="h-3 w-48 rounded bg-cp-bg2" />
				</div>
			))}
		</div>
	);
}

export function BillingPage() {
	const [statusFilter, setStatusFilter] = useState("");
	const subscriptions = useAdminSubscriptions(statusFilter || undefined);

	if (subscriptions.isPending) return <BillingSkeleton />;

	if (subscriptions.isError) {
		return (
			<section
				role="alert"
				aria-label="Error al cargar suscripciones"
				className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
			>
				<i
					className="fi fi-rr-exclamation-circle mb-3 block text-2xl text-destructive"
					aria-hidden="true"
				/>
				<h2 className="font-display text-lg font-semibold text-ink">
					No se pudieron cargar las suscripciones
				</h2>
				<p className="mt-1 text-sm text-ink2">
					{subscriptions.error instanceof Error
						? subscriptions.error.message
						: "Error desconocido"}
				</p>
			</section>
		);
	}

	const data = subscriptions.data?.subscriptions ?? [];

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-display text-xl font-semibold tracking-tight text-ink">
					Suscripciones
				</h2>
				<select
					aria-label="Filtrar por estado"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="h-9 rounded-lg border border-line bg-cp-surface px-3 text-[13.5px] text-ink focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
				>
					{STATUS_OPTIONS.map(({ value, label }) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
				</select>
			</div>

			{data.length === 0 ? (
				<section className="rounded-xl border border-line bg-cp-surface p-8 text-center">
					<i
						className="fi fi-rr-credit-card mb-3 block text-3xl text-ink3"
						aria-hidden="true"
					/>
					<p className="text-sm font-medium text-ink2">
						No se encontraron suscripciones
					</p>
				</section>
			) : (
				<div className="overflow-x-auto rounded-xl border border-line">
					<table
						className="w-full text-left text-sm"
						role="table"
						aria-label="Suscripciones"
					>
						<thead>
							<tr className="border-b border-line bg-cp-bg2 text-[11px] font-semibold uppercase tracking-wider text-ink3">
								<th className="px-4 py-3">Taller</th>
								<th className="px-4 py-3">Plan</th>
								<th className="px-4 py-3">Proveedor</th>
								<th className="px-4 py-3">Estado</th>
								<th className="px-4 py-3">Vence</th>
								<th className="px-4 py-3">Actualizado</th>
								<th className="px-4 py-3">
									<span className="sr-only">Taller</span>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{data.map((sub) => (
								<tr
									key={sub.id}
									className="bg-cp-surface transition-colors hover:bg-cp-bg2"
								>
									<td className="px-4 py-3 font-medium text-ink">
										{sub.workshopName}
									</td>
									<td className="px-4 py-3 text-ink2 capitalize">
										{sub.plan}
									</td>
									<td className="px-4 py-3 text-ink2">
										{sub.provider === "mercadopago"
											? "MercadoPago"
											: sub.provider}
									</td>
									<td className="px-4 py-3">{statusBadge(sub.status)}</td>
									<td className="px-4 py-3 text-ink2">
										{sub.currentPeriodEnd
											? new Date(
													sub.currentPeriodEnd,
												).toLocaleDateString("es-AR", {
													day: "numeric",
													month: "short",
													year: "numeric",
												})
											: "—"}
									</td>
									<td className="px-4 py-3 text-ink2">
										{new Date(sub.updatedAt).toLocaleDateString(
											"es-AR",
											{
												day: "numeric",
												month: "short",
												year: "numeric",
											},
										)}
									</td>
									<td className="px-4 py-3">
										<Link
											to={`/admin/workshops/${sub.workshopId}`}
											className="text-[13px] font-medium text-cp-accent hover:underline"
											aria-label={`Ver taller ${sub.workshopName}`}
										>
											Taller
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
