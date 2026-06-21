import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/shared/ui/page-header";
import { useAdminSupportDiagnostics } from "../hooks/useAdminSupportDiagnostics";
import { useAdminWorkshops } from "../hooks/useAdminWorkshops";
import { useRetryWebhook } from "../hooks/useAdminActions";
import { useSort } from "../lib/useSort";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/ui/table";
import { EmptyState, ErrorState } from "@/shared/ui/feedback-state";

function eventTypeBadge(eventType: string) {
	const isFailure = eventType.toLowerCase().includes("fail");
	return (
		<span
			className={
				isFailure
					? "chip-danger rounded-full px-2.5 py-0.5 text-[11px] font-medium"
					: "chip-success rounded-full px-2.5 py-0.5 text-[11px] font-medium"
			}
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
	const retryMutation = useRetryWebhook();
	const workshops = useAdminWorkshops();
	const workshopOptions = workshops.data?.workshops ?? [];
	const data = diagnostics.data?.diagnostics ?? [];
	const { sorted, sortKey, sortDir, toggleSort } = useSort(
		data,
		"processedAt",
		"desc",
	);
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
				aria-label="Error al cargar diagnósticos"
			>
				<ErrorState
					title="No se pudieron cargar los diagnósticos"
					description={
						diagnostics.error instanceof Error
							? diagnostics.error.message
							: "Error desconocido"
					}
				/>
			</section>
		);
	}

	return (
		<div className="space-y-4">
			<PageHeader
				level="h2"
				title="Diagnósticos de soporte"
				subtitle={`Últimos 50 eventos de webhook · ${data.length} evento${data.length !== 1 ? "s" : ""}${lastUpdated ? ` · Actualizado ${lastUpdated}` : ""}`}
				actions={
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
				}
			/>

			{data.length === 0 ? (
				<EmptyState
					variant="no-results"
					title="No se encontraron diagnósticos"
					description="Aún no hay eventos de webhook registrados"
				/>
			) : (
				<div className="rounded-xl border border-line overflow-hidden">
					<Table aria-label="Diagnósticos de soporte">
						<TableHeader>
							<TableRow>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("providerEventId")}
								>
									Evento{" "}
									{sortKey === "providerEventId" &&
										(sortDir === "asc" ? "↑" : "↓")}
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("eventType")}
								>
									Tipo{" "}
									{sortKey === "eventType" && (sortDir === "asc" ? "↑" : "↓")}
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("provider")}
								>
									Proveedor{" "}
									{sortKey === "provider" && (sortDir === "asc" ? "↑" : "↓")}
								</TableHead>
								<TableHead>Recurso</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("processedAt")}
								>
									Procesado{" "}
									{sortKey === "processedAt" && (sortDir === "asc" ? "↑" : "↓")}
								</TableHead>
								<TableHead>Taller</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sorted.map((evt) => (
								<TableRow key={evt.id}>
									<TableCell className="font-mono text-xs text-ink">
										{evt.providerEventId}
									</TableCell>
									<TableCell>{eventTypeBadge(evt.eventType)}</TableCell>
									<TableCell className="text-ink2">
										{evt.provider === "mercadopago"
											? "MercadoPago"
											: evt.provider}
									</TableCell>
									<TableCell className="font-mono text-xs text-ink2">
										{evt.providerResourceId ?? "—"}
									</TableCell>
									<TableCell className="text-ink2">
										{new Date(evt.processedAt).toLocaleDateString("es-AR", {
											day: "numeric",
											month: "short",
											year: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Link
												to={`/admin/workshops/${evt.workshopId}`}
												className="text-[13px] font-medium text-cp-accent hover:underline"
												aria-label={`Ver taller ${evt.workshopId}`}
											>
												Taller
											</Link>
											{evt.eventType.toLowerCase().includes("fail") && (
												<button
													type="button"
													onClick={() => retryMutation.mutate(evt.id)}
													className="text-[11px] text-amber-600 hover:underline"
												>
													Reintentar
												</button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
