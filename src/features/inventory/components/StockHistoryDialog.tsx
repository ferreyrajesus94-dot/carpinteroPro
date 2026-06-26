import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import { useStockMovements } from "../hooks/useStockMovements";
import { formatSignedQuantity, REASON_LABELS } from "../lib/stockMovementLabels";
import type { Material } from "../types";

interface StockHistoryDialogProps {
	material: Material;
}

const formatStock = (n: number) =>
	new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

export function StockHistoryDialog({ material }: StockHistoryDialogProps) {
	const { data: movements = [], isLoading } = useStockMovements(material.id);

	if (isLoading) {
		return (
			<div className="space-y-2">
				{[...Array(3)].map((_, i) => (
					<Skeleton key={i} className="h-12 w-full rounded-md" />
				))}
			</div>
		);
	}

	if (movements.length === 0) {
		return (
			<p className="text-center text-sm text-muted-foreground py-8">
				Todavía no hay movimientos para este material.
			</p>
		);
	}

	return (
		<div className="space-y-2">
			<p className="text-xs text-muted-foreground">
				Stock actual: <strong>{formatStock(material.stock)}</strong>{" "}
				{material.unit} · {movements.length} movimiento
				{movements.length > 1 ? "s" : ""}
			</p>
			<div className="max-h-96 overflow-y-auto divide-y rounded-md border">
				{movements.map((m) => {
					const isIn = m.delta > 0;
					return (
						<div key={m.id} className="flex items-start gap-3 p-3 text-sm">
							<div
								className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
									isIn
										? "bg-green-500/15 text-green-600"
										: "bg-destructive/15 text-destructive"
								}`}
							>
								{isIn ? (
									<ArrowUp className="h-4 w-4" />
								) : (
									<ArrowDown className="h-4 w-4" />
								)}
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-baseline justify-between gap-2">
									<span className="font-medium">{REASON_LABELS[m.reason]}</span>
									<span
										className={`font-mono font-semibold ${isIn ? "text-green-600" : "text-destructive"}`}
									>
										{formatSignedQuantity(m.delta)}
									</span>
								</div>
								<p className="text-xs text-muted-foreground">
									{format(parseISO(m.created_at), "d MMM yyyy, HH:mm", {
										locale: es,
									})}
								</p>
								{m.note && <p className="text-xs mt-1">{m.note}</p>}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
