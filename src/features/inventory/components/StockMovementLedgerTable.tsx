import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { AlertTriangle, Inbox, Factory } from "lucide-react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/ui/table";
import { Skeleton } from "@/shared/ui/skeleton";
import type { StockMovementLedgerRow } from "../api/stockMovements";
import {
	formatSignedQuantity,
	REASON_LABELS,
} from "../lib/stockMovementLabels";

interface StockMovementLedgerTableProps {
	rows: StockMovementLedgerRow[];
	isLoading?: boolean;
	error?: Error | null;
	onRetry?: () => void;
}

function formatDate(iso: string): string {
	try {
		return format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: es });
	} catch {
		return iso;
	}
}

function getDisplayNote(row: StockMovementLedgerRow): string {
	if (row.is_reversal) return row.reversal_reason ?? row.note ?? "—";
	return row.note ?? "—";
}

export function StockMovementLedgerTable({
	rows,
	isLoading,
	error,
	onRetry,
}: StockMovementLedgerTableProps) {
	if (error) {
		return (
			<div
				role="alert"
				className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-cp-bg2 p-8 text-center"
			>
				<span className="grid h-12 w-12 place-items-center rounded-full bg-cp-danger/10">
					<AlertTriangle
						className="h-6 w-6 text-cp-danger"
						aria-hidden="true"
					/>
				</span>
				<p className="font-medium text-ink">Error al cargar movimientos</p>
				<p className="mt-1 text-[13px] text-ink3">
					{error.message || "Ocurrió un error inesperado."}
				</p>
				{onRetry ? (
					<button
						type="button"
						onClick={onRetry}
						className="mt-2 rounded-md border border-line bg-cp-bg px-3 py-1.5 text-sm font-medium text-ink hover:bg-cp-bg2"
					>
						Reintentar
					</button>
				) : null}
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton
						key={i}
						className="h-12 w-full rounded-md"
						data-testid="skeleton"
					/>
				))}
			</div>
		);
	}

	if (rows.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-cp-bg2 p-8 text-center">
				<span className="grid h-12 w-12 place-items-center rounded-full bg-cp-accent-soft">
					<Inbox className="h-5 w-5 text-cp-accent" aria-hidden="true" />
				</span>
				<p className="font-medium text-ink">Sin movimientos</p>
				<p className="mt-1 text-[13px] text-ink3">
					Todavía no hay movimientos de stock registrados.
				</p>
			</div>
		);
	}

	return (
		<div className="w-full max-w-full overflow-x-auto rounded-md border border-line">
			<Table className="min-w-[760px]">
				<TableHeader>
					<TableRow>
						<TableHead>Fecha</TableHead>
						<TableHead>Material</TableHead>
						<TableHead>Delta</TableHead>
						<TableHead>Motivo</TableHead>
						<TableHead>Nota</TableHead>
						<TableHead>Creado por</TableHead>
						<TableHead>Producción</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.id}>
							<TableCell className="text-xs whitespace-nowrap text-ink3">
								{formatDate(row.created_at)}
							</TableCell>
							<TableCell className="font-medium text-ink">
								<Link
									to={`/inventory/movements/${row.id}`}
									className="text-cp-accent hover:underline"
								>
									{row.material_name}
								</Link>
							</TableCell>
							<TableCell>
								<span
									className={`font-mono font-semibold ${
										row.delta > 0 ? "text-green-600" : "text-destructive"
									}`}
								>
									{formatSignedQuantity(row.delta)}
								</span>
							</TableCell>
							<TableCell className="text-sm text-ink2">
								{REASON_LABELS[row.reason] ?? row.reason}
							</TableCell>
							<TableCell className="max-w-[200px] truncate text-sm text-ink2">
								{getDisplayNote(row)}
							</TableCell>
							<TableCell className="text-sm text-ink2">
								{row.creator_name ?? "Sin registrar"}
							</TableCell>
							<TableCell className="text-sm text-ink2">
								{row.is_production_deduction ? (
									<div className="flex items-center gap-1.5">
										<Factory
											className="h-3.5 w-3.5 text-amber-600"
											aria-hidden="true"
										/>
										<span className="text-xs text-amber-700">
											{row.quote_number ?? "Producción"}
										</span>
									</div>
								) : (
									<span className="text-xs text-ink3">—</span>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
