import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/shared/ui/page-header";
import { useAdminWorkshops } from "../hooks/useAdminWorkshops";
import { useSort } from "../lib/useSort";
import { downloadCsv } from "../lib/downloadCsv";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/ui/table";
import { EmptyState, ErrorState } from "@/shared/ui/feedback-state";

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
	if (!active) return <span className="ml-1 text-ink3">↕</span>;
	return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

const STATUS_LABELS: Record<string, string> = {
	active: "activa",
	inactive: "inactiva",
	cancelled: "cancelada",
	paused: "pausada",
	past_due: "vencida",
	trial: "en prueba",
};

function statusBadge(status: string | null) {
	if (!status) {
		return (
			<span className="rounded-full border border-line bg-cp-bg2 px-2.5 py-0.5 text-[11px] font-medium text-ink3">
				sin suscripción
			</span>
		);
	}
	return (
		<span
			className={
				"rounded-full px-2.5 py-0.5 text-[11px] font-medium " +
				(status === "active" || status === "trial"
					? "chip-success"
					: status === "paused"
						? "chip-warn"
						: "chip-danger")
			}
		>
			{STATUS_LABELS[status] ?? status}
		</span>
	);
}

function WorkshopsSkeleton() {
	return (
		<div role="status" aria-label="Cargando talleres" className="space-y-3">
			{Array.from({ length: 4 }).map((_, i) => (
				<div
					key={i}
					className="animate-pulse rounded-lg border border-line bg-cp-surface p-4"
				>
					<div className="mb-2 h-4 w-40 rounded bg-cp-bg2" />
					<div className="h-3 w-56 rounded bg-cp-bg2" />
				</div>
			))}
		</div>
	);
}

export function WorkshopsPage() {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [debounceTimer, setDebounceTimer] = useState<ReturnType<
		typeof setTimeout
	> | null>(null);

	const workshops = useAdminWorkshops(debouncedSearch || undefined);
	const data = workshops.data?.workshops ?? [];
	const { sorted, sortKey, sortDir, toggleSort } = useSort(data, "name", "asc");
	const lastUpdated = workshops.dataUpdatedAt
		? new Date(workshops.dataUpdatedAt).toLocaleTimeString("es-AR", {
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;

	function handleSearchChange(value: string) {
		setSearch(value);
		if (debounceTimer) clearTimeout(debounceTimer);
		const timer = setTimeout(() => setDebouncedSearch(value), 300);
		setDebounceTimer(timer);
	}

	if (workshops.isPending) return <WorkshopsSkeleton />;

	if (workshops.isError) {
		return (
			<section
				aria-label="Error al cargar talleres"
			>
				<ErrorState
					title="No se pudieron cargar los talleres"
					description={
						workshops.error instanceof Error
							? workshops.error.message
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
				title="Talleres"
				subtitle={`${data.length} taller${data.length !== 1 ? "es" : ""}${lastUpdated ? ` · Actualizado ${lastUpdated}` : ""}`}
				actions={
					<div className="flex items-center gap-2">
						{data.length > 0 && (
							<button
								type="button"
								onClick={() =>
									downloadCsv(
										["Nombre", "Dueño", "Creado", "Perfiles", "Onboardeados", "Suscripción"],
										data.map((w) => [
											w.name,
											w.ownerEmail ?? "",
											w.createdAt,
											String(w.profileCount),
											String(w.onboardedProfileCount),
											w.subscriptionStatus ?? "",
										]),
										"talleres.csv",
									)
								}
								className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-cp-surface px-3 text-xs font-medium text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
							>
								<i className="fi fi-rr-download text-sm leading-none" aria-hidden="true" />
								Exportar
							</button>
						)}
					<div className="relative">
						<i
							className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink3"
							aria-hidden="true"
						/>
						<input
							type="search"
							role="searchbox"
							aria-label="Buscar talleres"
							placeholder="Buscar por nombre..."
							value={search}
							onChange={(e) => handleSearchChange(e.target.value)}
							className="h-9 rounded-lg border border-line bg-cp-surface pl-9 pr-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
						/>
					</div>
					</div>
				}
			/>

			{data.length === 0 ? (
				<EmptyState
					variant={debouncedSearch ? "no-results" : "empty-feature"}
					title="No se encontraron talleres"
					description={
						debouncedSearch
							? `No hay resultados para "${debouncedSearch}"`
							: "Aún no hay talleres registrados en la plataforma"
					}
				/>
			) : (
				<div
					className="rounded-xl border border-line overflow-hidden"
					role="region"
					aria-label="Tabla de talleres con scroll horizontal"
					tabIndex={0}
				>
					<Table aria-label="Talleres">
						<TableHeader>
							<TableRow>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("name")}
								>
									Nombre <SortArrow active={sortKey === "name"} dir={sortDir} />
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("ownerEmail")}
								>
									Dueño{" "}
									<SortArrow active={sortKey === "ownerEmail"} dir={sortDir} />
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("createdAt")}
								>
									Creado{" "}
									<SortArrow active={sortKey === "createdAt"} dir={sortDir} />
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("profileCount")}
								>
									Perfiles{" "}
									<SortArrow
										active={sortKey === "profileCount"}
										dir={sortDir}
									/>
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("onboardedProfileCount")}
								>
									Onboardeados{" "}
									<SortArrow
										active={sortKey === "onboardedProfileCount"}
										dir={sortDir}
									/>
								</TableHead>
								<TableHead
									className="cursor-pointer select-none hover:text-ink"
									onClick={() => toggleSort("subscriptionStatus")}
								>
									Suscripción{" "}
									<SortArrow
										active={sortKey === "subscriptionStatus"}
										dir={sortDir}
									/>
								</TableHead>
								<TableHead>
									<span className="sr-only">Acciones</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sorted.map((workshop) => (
								<TableRow key={workshop.id}>
									<TableCell className="font-medium text-ink">
										{workshop.name}
									</TableCell>
									<TableCell className="text-ink2 max-w-[160px] truncate" title={workshop.ownerEmail ?? undefined}>
										{workshop.ownerEmail ?? "—"}
									</TableCell>
									<TableCell className="text-ink2">
										{new Date(workshop.createdAt).toLocaleDateString("es-AR", {
											day: "numeric",
											month: "short",
											year: "numeric",
										})}
									</TableCell>
									<TableCell className="font-mono text-ink">
										{workshop.profileCount}
									</TableCell>
									<TableCell className="font-mono text-ink">
										{workshop.onboardedProfileCount}
									</TableCell>
									<TableCell>
										{statusBadge(workshop.subscriptionStatus)}
									</TableCell>
									<TableCell>
										<Link
											to={`/admin/workshops/${workshop.id}`}
											className="text-[13px] font-medium text-cp-accent hover:underline"
											aria-label="Ver detalle"
										>
											Detalle
										</Link>
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
