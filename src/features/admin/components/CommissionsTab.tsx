import { useRef, useState, useMemo } from "react";
import { useAdminCommissions, useAdminYoutubers } from "../hooks/useReferrals";
import { exportCommissionsCsv } from "../api/referrals";
import { formatARS, formatDate } from "../lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

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

const STALE_DAYS_THRESHOLD = 30;

function countStaleCommissions(
	commissions: Array<{ occurredAt: string; status: string }>,
): number {
	const now = new Date();
	return commissions.filter((c) => {
		if (c.status !== "pending") return false;
		const occurred = new Date(c.occurredAt);
		const diffDays =
			(now.getTime() - occurred.getTime()) / (1000 * 60 * 60 * 24);
		return diffDays > STALE_DAYS_THRESHOLD;
	}).length;
}

export function CommissionsTab() {
	const [youtuberFilter, setYoutuberFilter] = useState("");
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");
	const downloadRef = useRef<HTMLAnchorElement>(null);

	const filters = {
		...(youtuberFilter ? { youtuberId: youtuberFilter } : {}),
		...(fromDate ? { fromDate } : {}),
		...(toDate ? { toDate } : {}),
	};

	const commissions = useAdminCommissions(filters);
	const youtubers = useAdminYoutubers();

	const data = useMemo(
		() => commissions.data?.commissions ?? [],
		[commissions.data?.commissions],
	);
	const youtuberOptions = youtubers.data?.youtubers ?? [];

	const staleCount = useMemo(() => countStaleCommissions(data), [data]);

	async function handleExportCsv() {
		try {
			const csv = await exportCommissionsCsv(filters);
			const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const link = downloadRef.current;
			if (link) {
				link.href = url;
				link.download = `referral-commissions-${new Date().toISOString().slice(0, 10)}.csv`;
				link.click();
			}
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("CSV export falló", err);
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
			<a
				ref={downloadRef}
				className="hidden"
				aria-hidden="true"
				tabIndex={-1}
			/>
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

			{/* Stale commission badge */}
			{staleCount > 0 && (
				<div
					role="alert"
					aria-label={`${staleCount} comisiones vencidas`}
					className="flex items-center gap-2 rounded-lg border border-cp-danger/30 bg-cp-danger/10 px-3 py-2 text-sm text-cp-danger"
				>
					<i
						className="fi fi-rr-exclamation-triangle text-sm leading-none"
						aria-hidden="true"
					/>
					<span className="font-medium">
						{staleCount} comisión{staleCount !== 1 ? "es" : ""} {">"}30 días
						pendiente{staleCount !== 1 ? "s" : ""}
					</span>
				</div>
			)}

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
				<div className="overflow-hidden rounded-xl border border-line">
					<Table aria-label="Comisiones">
						<TableHeader>
							<TableRow>
								<TableHead>Fecha</TableHead>
								<TableHead>YouTuber</TableHead>
								<TableHead>Código</TableHead>
								<TableHead>Taller</TableHead>
								<TableHead className="text-right">Pago</TableHead>
								<TableHead className="text-right">Comisión</TableHead>
								<TableHead>Moneda</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.map((c) => (
								<TableRow key={c.id}>
									<TableCell className="whitespace-nowrap">
										{formatDate(c.occurredAt)}
									</TableCell>
									<TableCell className="font-medium text-ink">
										{c.youtuberName ?? "—"}
									</TableCell>
									<TableCell className="font-mono text-xs text-ink2">
										{c.code ?? "—"}
									</TableCell>
									<TableCell className="text-ink2">
										{c.workshopName ?? "—"}
									</TableCell>
									<TableCell className="text-right font-mono text-xs text-ink">
										{formatARS(c.paymentAmount)}
									</TableCell>
									<TableCell className="text-right font-mono text-xs text-ink">
										{formatARS(c.commissionAmount)}
									</TableCell>
									<TableCell className="text-xs text-ink2">{c.currency}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
