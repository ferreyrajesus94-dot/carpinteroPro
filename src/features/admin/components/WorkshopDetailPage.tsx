import { Link, useParams } from "react-router-dom";
import { useAdminWorkshopDetail } from "../hooks/useAdminWorkshops";
import { useToggleWorkshop, useForceOnboarding } from "../hooks/useAdminActions";
import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/eyebrow";

const STATUS_LABELS: Record<string, string> = {
	active: "activa",
	inactive: "inactiva",
	cancelled: "cancelada",
	paused: "pausada",
	past_due: "vencida",
	trial: "en prueba",
};

function DetailSkeleton() {
	return (
		<div
			role="status"
			aria-label="Cargando detalle del taller"
			className="space-y-4"
		>
			<div className="animate-pulse rounded-xl border border-line bg-cp-surface p-6">
				<div className="mb-3 h-5 w-48 rounded bg-cp-bg2" />
				<div className="mb-2 h-4 w-32 rounded bg-cp-bg2" />
				<div className="h-4 w-56 rounded bg-cp-bg2" />
			</div>
			<div className="animate-pulse rounded-xl border border-line bg-cp-surface p-6">
				<div className="mb-3 h-4 w-36 rounded bg-cp-bg2" />
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="h-14 rounded bg-cp-bg2" />
					<div className="h-14 rounded bg-cp-bg2" />
				</div>
			</div>
		</div>
	);
}

export function WorkshopDetailPage() {
	const { workshopId } = useParams<{ workshopId: string }>();
	const detail = useAdminWorkshopDetail(workshopId ?? "");
	const toggleMutation = useToggleWorkshop();
	const forceOnboardingMutation = useForceOnboarding();

	if (detail.isPending) return <DetailSkeleton />;

	if (detail.isError) {
		const isNotFound =
			detail.error instanceof Error &&
			detail.error.message.includes("no encontrado");

		return (
			<section
				role={isNotFound ? undefined : "alert"}
				aria-label={isNotFound ? undefined : "Error al cargar el detalle"}
				className="rounded-xl border border-line bg-cp-surface p-8 text-center"
			>
				<i
					className={`fi ${isNotFound ? "fi-rr-search-alt" : "fi-rr-exclamation-circle"} mb-3 block text-3xl ${isNotFound ? "text-ink3" : "text-destructive"}`}
					aria-hidden="true"
				/>
				<h2 className="font-display text-lg font-semibold text-ink">
					{isNotFound ? "Taller no encontrado" : "No se pudo cargar el detalle"}
				</h2>
				<p className="mt-1 text-sm text-ink2">
					{isNotFound
						? "El taller solicitado no existe o fue eliminado."
						: detail.error instanceof Error
							? detail.error.message
							: "Error desconocido"}
				</p>
				<Link
					to="/admin/workshops"
					className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cp-accent hover:underline"
				>
					<i className="fi fi-rr-arrow-left text-xs" aria-hidden="true" />
					Volver a talleres
				</Link>
			</section>
		);
	}

	const workshop = detail.data?.workshop;

	if (!workshop) {
		return (
			<section className="rounded-xl border border-line bg-cp-surface p-8 text-center">
				<p className="text-sm text-ink2">Sin datos disponibles</p>
				<Link
					to="/admin/workshops"
					className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-cp-accent hover:underline"
				>
					<i className="fi fi-rr-arrow-left text-xs" aria-hidden="true" />
					Volver a talleres
				</Link>
			</section>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<Link
					to="/admin/workshops"
					className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink2 hover:text-ink transition-colors"
				>
					<i className="fi fi-rr-arrow-left text-xs" aria-hidden="true" />
					Volver a talleres
				</Link>

				<header className="rounded-xl border border-line bg-cp-surface p-6 shadow-sm">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<Eyebrow as="p" variant="mono">Taller</Eyebrow>
							<h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
								{workshop.name}
							</h1>
							<p className="mt-1 font-mono text-xs text-ink3">{workshop.id}</p>
							<p className="mt-2 text-sm text-ink2">
								Creado el{" "}
								{new Date(workshop.createdAt).toLocaleDateString("es-AR", {
									day: "numeric",
									month: "long",
									year: "numeric",
								})}
							</p>
						</div>
						<div className="flex flex-col items-end gap-2">
							<span
								className={cn(
									"rounded-full px-3 py-1 text-xs font-medium",
									workshop.isActive
										? "bg-emerald-100 text-emerald-700"
										: "bg-red-100 text-red-700",
								)}
							>
								{workshop.isActive ? "Activo" : "Inactivo"}
							</span>
							<button
								type="button"
								disabled={toggleMutation.isPending}
								onClick={() =>
									toggleMutation.mutate({
										workshopId: workshop.id,
										active: !workshop.isActive,
									})
								}
								className="text-[11px] text-ink3 hover:text-ink transition-colors disabled:opacity-50"
							>
								{workshop.isActive ? "Desactivar" : "Activar"}
							</button>
							{workshop.subscriptionStatus && (
								<span
									className={cn(
										"rounded-full px-3 py-1 text-xs font-medium",
										workshop.subscriptionStatus === "active" ||
											workshop.subscriptionStatus === "trial"
											? "bg-emerald-100 text-emerald-700"
											: workshop.subscriptionStatus === "paused"
												? "bg-amber-100 text-amber-700"
												: "bg-red-100 text-red-700",
									)}
								>
									{STATUS_LABELS[workshop.subscriptionStatus] ??
										workshop.subscriptionStatus}
								</span>
							)}
						</div>
					</div>
				</header>
			</div>

			<section
				className="rounded-xl border border-line bg-cp-surface p-6 shadow-sm"
				role="region"
				aria-label="Contexto de soporte"
			>
				<h2 className="font-display text-lg font-semibold text-ink">
					Contexto de soporte
				</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					<article className="rounded-lg border border-line bg-cp-bg2 p-4">
						<Eyebrow as="p">Perfiles totales</Eyebrow>
						<p className="mt-1 font-mono text-2xl font-bold text-ink">
							{workshop.profileCount}
						</p>
					</article>
					<article className="rounded-lg border border-line bg-cp-bg2 p-4">
						<Eyebrow as="p">Perfiles onboardeados</Eyebrow>
						<p className="mt-1 font-mono text-2xl font-bold text-ink">
							{workshop.onboardedProfileCount}
						</p>
					</article>
				</div>
				{workshop.ownerEmail === null && (
					<p className="mt-4 text-xs text-ink3">
						El dueño del taller aún no está identificado en el contrato de datos
						actual.
					</p>
				)}

				{workshop.profiles && workshop.profiles.length > 0 && (
					<div className="mt-6">
						<h3 className="text-sm font-semibold text-ink mb-3">Perfiles</h3>
						<ul className="space-y-2">
							{workshop.profiles.map((profile) => (
								<li
									key={profile.id}
									className="flex items-center justify-between rounded-lg border border-line bg-cp-bg2 px-4 py-2.5"
								>
									<div className="min-w-0">
										<p className="text-sm font-medium text-ink truncate">
											{profile.email ?? "Sin email"}
										</p>
										<p className="text-[11px] text-ink3 font-mono">
											{profile.id}
										</p>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										{profile.onboardedAt ? (
											<span className="rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[11px] font-medium">
												Onboardeado
											</span>
										) : (
											<button
												type="button"
												onClick={() =>
													forceOnboardingMutation.mutate(profile.id)
												}
												disabled={forceOnboardingMutation.isPending}
												className="text-[11px] font-medium text-cp-accent hover:underline disabled:opacity-50"
											>
												Forzar onboarding
											</button>
										)}
									</div>
								</li>
							))}
						</ul>
					</div>
				)}
			</section>
		</div>
	);
}
