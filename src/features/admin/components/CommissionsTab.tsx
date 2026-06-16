import { useState } from "react";
import {
	useAdminCommissions,
	useAdminYoutubers,
} from "../hooks/useReferrals";
import { exportCommissionsCsv } from "../api/referrals";

function formatARS(amount: number): string {
	return new Intl.NumberFormat("es-AR", {
		style: "currency",
		currency: "ARS",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("es-AR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(iso));
}

function CommissionsSkeleton() {
	return (
		<div role="status" aria-label="Cargando comisiones" className="space-y-3">
			{Array.from({ length: 4 }).map((_, i) => (
				<div
					key={i}
					className="animate-pulse rounded-lg border border-line bg-cp-surface p-4"
				>
					<div className="mb-2 h-4 w-48 rounded bg-cp-bg2" />
					<div className="h-3 w-32 rounded bg-cp-bg2" />
				</div>
			))}
		</div>
	);
}

export function CommissionsTab() {
	const [youtuberFilter, setYoutuberFilter] = useState("");
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");

	const filters = {
		...(youtuberFilter ? { youtuberId: youtuberFilter } : {}),
		...(fromDate ? { fromDate } : {}),
		...(toDate ? { toDate } : {}),
	};

	const commissions = useAdminCommissions(filters);
	const youtubers = useAdminYoutubers();

	const data = commissions.data?.commissions ?? [];
	const youtuberOptions = youtubers.data?.youtubers ?? [];

	async function handleExportCsv() {
		try {
			const csv = await exportCommissionsCsv(filters);
			const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `referral-commissions-${new Date().toISOString().slice(0, 10)}.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("CSV export failed", err);
		}
	}

	if (commissions.isPending) return <CommissionsSkeleton />;

	if (commissions.isError) {
		return (
			<section
				role="alert"
				aria-label="Error al cargar comisiones"
				className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
			>
				<i
					className="fi fi-rr-exclamation-circle mb-3 block text-2xl text-destructive"
					aria-hidden="true"
				/>
				<h2 className="font-display text-lg font-semibold text-ink">
					No se pudieron cargar las comisiones
				</h2>
				<p className="mt-1 text-sm text-ink2">
					{commissions.error instanceof Error
						? commissions.error.message
						: "Error desconocido"}
				</p>
			</section>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-[180px]">
					<label className="block text-[11px] font-medium text-ink3 mb-1">
						Filtrar por youtuber
					</label>
					<select
						aria-label="Filtrar por youtuber"
						value={youtuberFilter}
						onChange={(e) => setYoutuberFilter(e.target.value)}
						className="h-9 w-full rounded-lg border border-line bg-cp-surface px-3 text-[13.5px] text-ink focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
					>
						<option value="">Todos los youtubers</option>
						{youtuberOptions.map((yt) => (
							<option key={yt.id} value={yt.id}>
								{yt.displayName}
							</option>
						))}
					</select>
				</div>
				<div className="w-36">
					<label className="block text-[11px] font-medium text-ink3 mb-1">
						Desde
					</label>
					<input
						type="date"
						value={fromDate}
						onChange={(e) => setFromDate(e.target.value)}
						className="h-9 w-full rounded-lg border border-line bg-cp-surface px-3 text-[13.5px] text-ink focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
					/>
				</div>
				<div className="w-36">
					<label className="block text-[11px] font-medium text-ink3 mb-1">
						Hasta
					</label>
					<input
						type="date"
						value={toDate}
						onChange={(e) => setToDate(e.target.value)}
						className="h-9 w-full rounded-lg border border-line bg-cp-surface px-3 text-[13.5px] text-ink focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
					/>
				</div>
				<button
					type="button"
					onClick={handleExportCsv}
					className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-cp-surface px-3 text-xs font-medium text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
				>
					<i
						className="fi fi-rr-download text-sm leading-none"
						aria-hidden="true"
					/>
					Exportar CSV
				</button>
			</div>

			{data.length === 0 ? (
				<section className="rounded-xl border border-line bg-cp-surface p-8 text-center">
					<i
						className="fi fi-rr-receipt mb-3 block text-3xl text-ink3"
						aria-hidden="true"
					/>
					<p className="text-sm font-medium text-ink2">
						No se encontraron comisiones
					</p>
					<p className="mt-1 text-xs text-ink3">
						Las comisiones aparecen aquí cuando un YouTuber recibe pagos por
						talleres referidos.
					</p>
				</section>
			) : (
				<div className="overflow-x-auto rounded-xl border border-line">
					<table
						className="w-full text-left text-sm"
						role="table"
						aria-label="Comisiones"
					>
						<thead>
							<tr className="border-b border-line bg-cp-bg2 text-[11px] font-semibold uppercase tracking-wider text-ink3">
								<th className="px-4 py-3">Fecha</th>
								<th className="px-4 py-3">YouTuber</th>
								<th className="px-4 py-3">Código</th>
								<th className="px-4 py-3">Taller</th>
								<th className="px-4 py-3 text-right">Pago</th>
								<th className="px-4 py-3 text-right">Comisión</th>
								<th className="px-4 py-3">Moneda</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{data.map((c) => (
								<tr key={c.id} className="bg-cp-surface">
									<td className="px-4 py-3 text-xs text-ink2 whitespace-nowrap">
										{formatDate(c.occurredAt)}
									</td>
									<td className="px-4 py-3 font-medium text-ink">
										{c.youtuberName ?? "—"}
									</td>
									<td className="px-4 py-3 font-mono text-xs text-ink2">
										{c.code ?? "—"}
									</td>
									<td className="px-4 py-3 text-ink2">
										{c.workshopName ?? "—"}
									</td>
									<td className="px-4 py-3 text-right font-mono text-xs text-ink">
										{formatARS(c.paymentAmount)}
									</td>
									<td className="px-4 py-3 text-right font-mono text-xs text-ink">
										{formatARS(c.commissionAmount)}
									</td>
									<td className="px-4 py-3 text-xs text-ink2">{c.currency}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
