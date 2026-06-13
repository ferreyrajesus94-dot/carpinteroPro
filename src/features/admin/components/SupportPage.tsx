import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminSupportDiagnostics } from "../hooks/useAdminSupportDiagnostics";
import { useAdminWorkshops } from "../hooks/useAdminWorkshops";
import { useSort } from "../lib/useSort";
import { cn } from "@/shared/lib/utils";

function eventTypeBadge(eventType: string) {
	const isFailure = eventType.toLowerCase().includes("fail");
	return (
		<span
			className={cn(
				"rounded-full px-2.5 py-0.5 text-[11px] font-medium",
				isFailure
					? "bg-red-100 text-red-700"
					: "bg-emerald-100 text-emerald-700",
			)}
		>
			{eventType}
		</span>
	);
}

function SupportSkeleton() {
	return (
		<div
			role="status"
			aria-label="Cargando diagnósticos de soporte"
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

export function SupportPage() {
	const [workshopFilter, setWorkshopFilter] = useState("");
	const diagnostics = useAdminSupportDiagnostics(workshopFilter || undefined);
	const workshops = useAdminWorkshops();
	const workshopOptions = workshops.data?.workshops ?? [];
	const data = diagnostics.data?.diagnostics ?? [];
	const { sorted, sortKey, sortDir, toggleSort } = useSort(data, "processedAt", "desc");
	const lastUpdated = diagnostics.dataUpdatedAt
		? new Date(diagnostics.dataUpdatedAt).toLocaleTimeString("es-AR", {
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;

	if (diagnostics.isPending) return <SupportSkeleton />;

	if (diagnostics.isError) {
		return (
			<section
				role="alert"
				aria-label="Error al cargar diagnósticos"
				className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
			>
				<i
					className="fi fi-rr-exclamation-circle mb-3 block text-2xl text-destructive"
					aria-hidden="true"
				/>
				<h2 className="font-display text-lg font-semibold text-ink">
					No se pudieron cargar los diagnósticos
				</h2>
				<p className="mt-1 text-sm text-ink2">
					{diagnostics.error instanceof Error
						? diagnostics.error.message
						: "Error desconocido"}
				</p>
			</section>
		);
	}

	return (
		<div className="space-y-4">
			<header className="flex flex-wrap items-baseline justify-between gap-2">
				<div>
					<h2 className="font-display text-xl font-semibold tracking-tight text-ink">
						Diagnósticos de soporte
					</h2>
					<p className="text-xs text-ink3">
						Últimos 50 eventos de webhook · {data.length} evento
						{data.length !== 1 ? "s" : ""}
						{lastUpdated && ` · Actualizado ${lastUpdated}`}
					</p>
				</div>
				<select
					aria-label="Filtrar por taller"
					value={workshopFilter}
					onChange={(e) => setWorkshopFilter(e.target.value)}
					className="h-9 rounded-lg border border-line bg-cp-surface px-3 text-[13.5px] text-ink focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
				>
					<option value="">Todos los talleres</option>
					{workshopOptions.map((w) => (
						<option key={w.id} value={w.id}>
							{w.name}
						</option>
					))}
				</select>
			</header>

			{data.length === 0 ? (
				<section className="rounded-xl border border-line bg-cp-surface p-8 text-center">
					<i
						className="fi fi-rr-life-ring mb-3 block text-3xl text-ink3"
						aria-hidden="true"
					/>
					<p className="text-sm font-medium text-ink2">
						No se encontraron diagnósticos
					</p>
					<p className="mt-1 text-xs text-ink3">
						Aún no hay eventos de webhook registrados
					</p>
				</section>
			) : (
				<div className="overflow-x-auto rounded-xl border border-line">
					<table
						className="w-full text-left text-sm"
						role="table"
						aria-label="Diagnósticos de soporte"
					>
						<thead>
							<tr className="border-b border-line bg-cp-bg2 text-[11px] font-semibold uppercase tracking-wider text-ink3">
								<th className="px-4 py-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("providerEventId")}>
									Evento {sortKey === "providerEventId" && (sortDir === "asc" ? "↑" : "↓")}
								</th>
								<th className="px-4 py-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("eventType")}>
									Tipo {sortKey === "eventType" && (sortDir === "asc" ? "↑" : "↓")}
								</th>
								<th className="px-4 py-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("provider")}>
									Proveedor {sortKey === "provider" && (sortDir === "asc" ? "↑" : "↓")}
								</th>
								<th className="px-4 py-3">Recurso</th>
								<th className="px-4 py-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("processedAt")}>
									Procesado {sortKey === "processedAt" && (sortDir === "asc" ? "↑" : "↓")}
								</th>
								<th className="px-4 py-3">Taller</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{sorted.map((evt) => (
								<tr
									key={evt.id}
									className="bg-cp-surface transition-colors hover:bg-cp-bg2"
								>
									<td className="px-4 py-3 font-mono text-xs text-ink">
										{evt.providerEventId}
									</td>
									<td className="px-4 py-3">{eventTypeBadge(evt.eventType)}</td>
									<td className="px-4 py-3 text-ink2">
										{evt.provider === "mercadopago"
											? "MercadoPago"
											: evt.provider}
									</td>
									<td className="px-4 py-3 font-mono text-xs text-ink2">
										{evt.providerResourceId ?? "—"}
									</td>
									<td className="px-4 py-3 text-ink2">
										{new Date(evt.processedAt).toLocaleDateString("es-AR", {
											day: "numeric",
											month: "short",
											year: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</td>
									<td className="px-4 py-3">
										<Link
											to={`/admin/workshops/${evt.workshopId}`}
											className="text-[13px] font-medium text-cp-accent hover:underline"
											aria-label={`Ver taller ${evt.workshopId}`}
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
