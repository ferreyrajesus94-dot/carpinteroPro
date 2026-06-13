import { Link } from "react-router-dom";
import { useAdminSupportDiagnostics } from "../hooks/useAdminSupportDiagnostics";
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
	const diagnostics = useAdminSupportDiagnostics();

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

	const data = diagnostics.data?.diagnostics ?? [];

	return (
		<div className="space-y-4">
			<div>
				<h2 className="font-display text-xl font-semibold tracking-tight text-ink">
					Diagnósticos de soporte
				</h2>
				<p className="mt-1 text-sm text-ink2">
					Últimos 50 eventos de webhook de billing
				</p>
			</div>

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
								<th className="px-4 py-3">Evento</th>
								<th className="px-4 py-3">Tipo</th>
								<th className="px-4 py-3">Proveedor</th>
								<th className="px-4 py-3">Recurso</th>
								<th className="px-4 py-3">Procesado</th>
								<th className="px-4 py-3">Taller</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{data.map((evt) => (
								<tr
									key={evt.id}
									className="bg-cp-surface transition-colors hover:bg-cp-bg2"
								>
									<td className="px-4 py-3 font-mono text-xs text-ink">
										{evt.providerEventId}
									</td>
									<td className="px-4 py-3">
										{eventTypeBadge(evt.eventType)}
									</td>
									<td className="px-4 py-3 text-ink2">
										{evt.provider === "mercadopago"
											? "MercadoPago"
											: evt.provider}
									</td>
									<td className="px-4 py-3 font-mono text-xs text-ink2">
										{evt.providerResourceId ?? "—"}
									</td>
									<td className="px-4 py-3 text-ink2">
										{new Date(evt.processedAt).toLocaleDateString(
											"es-AR",
											{
												day: "numeric",
												month: "short",
												year: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											},
										)}
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
