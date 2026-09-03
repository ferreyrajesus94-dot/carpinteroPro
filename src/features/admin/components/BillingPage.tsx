import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/shared/ui/page-header";
import { useAdminSubscriptions } from "../hooks/useAdminSubscriptions";
import {
	useCancelSubscription,
	useToggleSubscription,
} from "../hooks/useAdminActions";
import { useSort } from "../lib/useSort";
import { downloadCsv } from "../lib/downloadCsv";
import { cn } from "@/shared/lib/utils";
import { RetryButton } from "@/shared/components/RetryButton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/ui/table";
import { EmptyState, ErrorState } from "@/shared/ui/feedback-state";

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
					? "chip-success"
					: status === "paused"
						? "chip-warn"
						: "chip-danger",
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
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
	const subscriptions = useAdminSubscriptions(statusFilter || undefined);
	const cancelMutation = useCancelSubscription();
	const toggleMutation = useToggleSubscription();
	const data = subscriptions.data?.subscriptions ?? [];
	const { sorted, sortKey, sortDir, toggleSort } = useSort(
		data,
		"workshopName",
		"asc",
	);
	const lastUpdated = subscriptions.dataUpdatedAt
		? new Date(subscriptions.dataUpdatedAt).toLocaleTimeString("es-AR", {
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;

	if (subscriptions.isPending) return <BillingSkeleton />;

	if (subscriptions.isError) {
		return (
			<section
				aria-label="Error al cargar suscripciones"
			>
				<ErrorState
					title="No se pudieron cargar las suscripciones"
					description={
						subscriptions.error instanceof Error
							? subscriptions.error.message
							: "Error desconocido"
					}
					action={
						<RetryButton onRetry={() => subscriptions.refetch()} />
					}
				/>
			</section>
		);
	}

	return (
		<div className="space-y-4">
			<PageHeader
				level="h2"
				title="Suscripciones"
				subtitle={`${data.length} suscripción${data.length !== 1 ? "es" : ""}${lastUpdated ? ` · Actualizado ${lastUpdated}` : ""}`}
				actions={
					<div className="flex items-center gap-2">
					{data.length > 0 && (
						<button
							type="button"
							onClick={() =>
								downloadCsv(
									[
										"Taller",
										"Plan",
										"Proveedor",
										"Estado",
										"Vence",
										"Actualizado",
									],
									data.map((s) => [
										s.workshopName,
										s.plan,
										s.provider,
										s.status,
										s.currentPeriodEnd ?? "",
										s.updatedAt,
									]),
									"suscripciones.csv",
								)
							}
							className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-cp-surface px-3 text-xs font-medium text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
						>
							<i
								className="fi fi-rr-download text-sm leading-none"
								aria-hidden="true"
							/>
							Exportar
						</button>
					)}
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
			}
		/>

			{data.length === 0 ? (
				<EmptyState
					variant="empty-feature"
					title="No se encontraron suscripciones"
				/>
			) : (
				<div className="rounded-xl border border-line overflow-hidden">
					<Table aria-label="Suscripciones">
						<TableHeader>
							<TableRow>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("workshopName")}
								>
									Taller{" "}
									{sortKey === "workshopName" &&
										(sortDir === "asc" ? "↑" : "↓")}
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("plan")}
								>
									Plan {sortKey === "plan" && (sortDir === "asc" ? "↑" : "↓")}
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("provider")}
								>
									Proveedor{" "}
									{sortKey === "provider" && (sortDir === "asc" ? "↑" : "↓")}
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("status")}
								>
									Estado{" "}
									{sortKey === "status" && (sortDir === "asc" ? "↑" : "↓")}
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("currentPeriodEnd")}
								>
									Vence{" "}
									{sortKey === "currentPeriodEnd" &&
										(sortDir === "asc" ? "↑" : "↓")}
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("updatedAt")}
								>
									Actualizado{" "}
									{sortKey === "updatedAt" && (sortDir === "asc" ? "↑" : "↓")}
								</TableHead>
								<TableHead>
									<span className="sr-only">Acciones</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sorted.map((sub) => {
								const isExpanded = expandedId === sub.id;
								return (
									<Fragment key={sub.id}>
										<TableRow
											onClick={() => setExpandedId(isExpanded ? null : sub.id)}
											className="cursor-pointer"
										>
											<TableCell className="font-medium text-ink">
												{sub.workshopName}
											</TableCell>
											<TableCell className="text-ink2 capitalize">
												{sub.plan}
											</TableCell>
											<TableCell className="text-ink2">
												{sub.provider === "mercadopago"
													? "MercadoPago"
													: sub.provider}
											</TableCell>
											<TableCell>{statusBadge(sub.status)}</TableCell>
											<TableCell className="text-ink2">
												{sub.currentPeriodEnd
													? new Date(sub.currentPeriodEnd).toLocaleDateString(
															"es-AR",
															{
																day: "numeric",
																month: "short",
																year: "numeric",
															},
														)
													: "—"}
											</TableCell>
											<TableCell className="text-ink2">
												{new Date(sub.updatedAt).toLocaleDateString("es-AR", {
													day: "numeric",
													month: "short",
													year: "numeric",
												})}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<Link
														to={`/admin/workshops/${sub.workshopId}`}
														className="text-[13px] font-medium text-cp-accent hover:underline"
														aria-label={`Ver taller ${sub.workshopName}`}
														onClick={(e) => e.stopPropagation()}
													>
														Taller
													</Link>
													{sub.status !== "cancelled" && (
														<>
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	toggleMutation.mutate({
																		workshopId: sub.workshopId,
																		action:
																			sub.status === "paused"
																				? "resume"
																				: "pause",
																	});
																}}
																className="text-[11px] text-ink3 hover:text-ink transition-colors"
															>
																{sub.status === "paused"
																	? "Reanudar"
																	: "Pausar"}
															</button>
															{confirmCancelId === sub.id ? (
																<span className="flex items-center gap-1 text-[11px]">
																	¿Cancelar?
																	<button
																		type="button"
																		onClick={(e) => {
																			e.stopPropagation();
																			cancelMutation.mutate(sub.workshopId);
																			setConfirmCancelId(null);
																		}}
																		className="text-red-600 font-medium hover:underline"
																	>
																		Sí
																	</button>
																	<button
																		type="button"
																		onClick={(e) => {
																			e.stopPropagation();
																			setConfirmCancelId(null);
																		}}
																		className="text-ink3 hover:text-ink"
																	>
																		No
																	</button>
																</span>
															) : (
																<button
																	type="button"
																	onClick={(e) => {
																		e.stopPropagation();
																		setConfirmCancelId(sub.id);
																	}}
																	className="text-[11px] text-red-600 hover:underline"
																>
																	Cancelar
																</button>
															)}
														</>
													)}
												</div>
											</TableCell>
										</TableRow>
										{isExpanded && (
											<TableRow className="bg-cp-bg2">
												<TableCell colSpan={7} className="px-4 py-3">
													<div className="grid gap-2 text-xs sm:grid-cols-3">
														<div>
															<span className="font-medium text-ink3">
																ID Suscripción
															</span>
															<p className="mt-0.5 font-mono text-ink2">
																{sub.id}
															</p>
														</div>
														<div>
															<span className="font-medium text-ink3">
																ID Taller
															</span>
															<p className="mt-0.5 font-mono text-ink2">
																{sub.workshopId}
															</p>
														</div>
														<div>
															<span className="font-medium text-ink3">
																Proveedor ID
															</span>
															<p className="mt-0.5 font-mono text-ink2">
																{sub.providerPreapprovalId ?? "—"}
															</p>
														</div>
														<div>
															<span className="font-medium text-ink3">
																Estado proveedor
															</span>
															<p className="mt-0.5 text-ink2">
																{sub.providerStatus ?? "—"}
															</p>
														</div>
													</div>
												</TableCell>
											</TableRow>
										)}
									</Fragment>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
