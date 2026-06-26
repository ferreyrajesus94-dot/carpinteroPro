import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/shared/ui/page-header";
import { Button } from "@/shared/ui/button";
import { StockMovementLedgerFilters } from "./StockMovementLedgerFilters";
import { StockMovementLedgerTable } from "./StockMovementLedgerTable";
import { useStockMovementLedger } from "../hooks/useStockMovements";
import { fetchStockMovementLedger } from "../api/stockMovements";
import { exportStockMovementCsv, EXPORT_LIMIT } from "../lib/stockMovementCsv";
import type { StockMovementLedgerFilters as Filters } from "../api/stockMovements";

export function StockMovementLedgerPage() {
	const [filters, setFilters] = useState<Filters>({});

	const { data: rows = [], isLoading, error, refetch } =
		useStockMovementLedger(filters);

	const handleFiltersChange = (newFilters: Filters) => {
		setFilters(newFilters);
	};

	const handleExport = async () => {
		try {
			const data = await fetchStockMovementLedger({
				...filters,
				limit: EXPORT_LIMIT,
				offset: 0,
			});
			exportStockMovementCsv(data);
			if (data.length >= EXPORT_LIMIT) {
				toast.warning(
					`Exportación limitada a ${EXPORT_LIMIT} registros. Ajustá los filtros para exportar menos datos.`,
				);
			}
		} catch (err) {
			// Surface the error to Sentry/the global error reporter. The
			// direct fetch path bypasses the React Query MutationCache, so
			// the global handler in queryClient.ts does not fire here.
			console.error("stock-movement.csv-export failed", err);
			toast.error("Error al exportar");
		}
	};

	return (
		<div className="space-y-4 p-4 md:p-6">
			<PageHeader
				title="Movimientos de stock"
				actions={
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							aria-label="Exportar CSV"
							onClick={handleExport}
						>
							<Download className="h-4 w-4 mr-1" />
							Exportar CSV
						</Button>
						<Button variant="ghost" size="sm" asChild>
							<Link to="/inventory">
								<ArrowLeft className="h-4 w-4 mr-1" />
								Volver al inventario
							</Link>
						</Button>
					</div>
				}
			/>

			<StockMovementLedgerFilters
				filters={filters}
				onFiltersChange={handleFiltersChange}
			/>

			<StockMovementLedgerTable
				rows={rows}
				isLoading={isLoading}
				error={error}
				onRetry={refetch}
			/>
		</div>
	);
}
