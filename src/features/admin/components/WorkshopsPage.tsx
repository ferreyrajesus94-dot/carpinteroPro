import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminWorkshops } from "../hooks/useAdminWorkshops";
import { useSort } from "../lib/useSort";
import { cn } from "@/shared/lib/utils";

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
				role="alert"
				aria-label="Error al cargar talleres"
				className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
			>
				<i
					className="fi fi-rr-exclamation-circle mb-3 block text-2xl text-destructive"
					aria-hidden="true"
				/>
				<h2 className="font-display text-lg font-semibold text-ink">
					No se pudieron cargar los talleres
				</h2>
				<p className="mt-1 text-sm text-ink2">
					{workshops.error instanceof Error
						? workshops.error.message
						: "Error desconocido"}
				</p>
			</section>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-display text-xl font-semibold tracking-tight text-ink">
					Talleres
				</h2>
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

			{data.length === 0 ? (
				<section className="rounded-xl border border-line bg-cp-surface p-8 text-center">
					<i
						className="fi fi-rr-building mb-3 block text-3xl text-ink3"
						aria-hidden="true"
					/>
					<p className="text-sm font-medium text-ink2">
						No se encontraron talleres
					</p>
					<p className="mt-1 text-xs text-ink3">
						{debouncedSearch
							? `No hay resultados para "${debouncedSearch}"`
							: "Aún no hay talleres registrados en la plataforma"}
					</p>
				</section>
			) : (
				<div className="overflow-x-auto rounded-xl border border-line">
					<table
						className="w-full text-left text-sm"
						role="table"
						aria-label="Talleres"
					>
						<thead>
							<tr className="border-b border-line bg-cp-bg2 text-[11px] font-semibold uppercase tracking-wider text-ink3">
								<th className="px-4 py-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("name")}>
									Nombre <SortArrow active={sortKey === "name"} dir={sortDir} />
								</th>
								<th className="px-4 py-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("createdAt")}>
									Creado <SortArrow active={sortKey === "createdAt"} dir={sortDir} />
								</th>
								<th className="px-4 py-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("profileCount")}>
									Perfiles <SortArrow active={sortKey === "profileCount"} dir={sortDir} />
								</th>
								<th className="px-4 py-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("onboardedProfileCount")}>
									Onboardeados <SortArrow active={sortKey === "onboardedProfileCount"} dir={sortDir} />
								</th>
								<th className="px-4 py-3 cursor-pointer select-none hover:text-ink" onClick={() => toggleSort("subscriptionStatus")}>
									Suscripción <SortArrow active={sortKey === "subscriptionStatus"} dir={sortDir} />
								</th>
								<th className="px-4 py-3">
									<span className="sr-only">Acciones</span>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{sorted.map((workshop) => (
								<tr
									key={workshop.id}
									className="bg-cp-surface transition-colors hover:bg-cp-bg2"
								>
									<td className="px-4 py-3 font-medium text-ink">
										{workshop.name}
									</td>
									<td className="px-4 py-3 text-ink2">
										{new Date(workshop.createdAt).toLocaleDateString("es-AR", {
											day: "numeric",
											month: "short",
											year: "numeric",
										})}
									</td>
									<td className="px-4 py-3 font-mono text-ink">
										{workshop.profileCount}
									</td>
									<td className="px-4 py-3 font-mono text-ink">
										{workshop.onboardedProfileCount}
									</td>
									<td className="px-4 py-3">
										{statusBadge(workshop.subscriptionStatus)}
									</td>
									<td className="px-4 py-3">
										<Link
											to={`/admin/workshops/${workshop.id}`}
											className="text-[13px] font-medium text-cp-accent hover:underline"
											aria-label="Ver detalle"
										>
											Detalle
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
