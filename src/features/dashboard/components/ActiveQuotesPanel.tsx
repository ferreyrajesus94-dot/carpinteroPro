import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/shared/lib/formatters";
import {
	QUOTE_STATUS_COLORS,
	QUOTE_STATUS_LABELS,
} from "@/shared/types/quotes";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/ui/table";
import { getSalePrice, type DashboardStats } from "../hooks/useDashboardStats";

interface Props {
	quotes: DashboardStats["activeQuotes"];
}

function DashboardQuoteStatusBadge({
	status,
}: {
	status: DashboardStats["activeQuotes"][0]["status"];
}) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[status]}`}
		>
			{QUOTE_STATUS_LABELS[status]}
		</span>
	);
}

export function ActiveQuotesPanel({ quotes }: Props) {
	return (
		<div className="rounded-lg border bg-cp-surface shadow-sm">
			<div className="border-b px-5 py-4">
				<h3 className="text-sm font-semibold text-ink2">
					Presupuestos activos
				</h3>
			</div>

			{quotes.length === 0 ? (
				<div className="px-5 py-10 text-center text-sm text-ink2">
					No hay presupuestos activos
				</div>
			) : (
				<>
					{/* Mobile: cards */}
					<div className="sm:hidden space-y-2 p-4">
						{quotes.map((q) => (
							<Link
								key={q.id}
								to={`/quotes/${q.id}`}
								className="block rounded-md border p-3 space-y-1 hover:bg-cp-bg2/40"
							>
								<div className="flex items-center justify-between">
									<span className="font-mono text-sm font-medium">
										{q.quote_number}
									</span>
									<DashboardQuoteStatusBadge status={q.status} />
								</div>
								<p className="text-sm font-medium">{q.furniture_name}</p>
								<div className="flex items-center justify-between text-xs text-ink2">
									<span>{q.client?.name ?? "—"}</span>
									<span>{formatCurrency(getSalePrice(q))}</span>
								</div>
							</Link>
						))}
					</div>

					{/* Desktop: table */}
					<div className="hidden sm:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Nº</TableHead>
									<TableHead>Mueble</TableHead>
									<TableHead>Cliente</TableHead>
									<TableHead className="text-right">Total</TableHead>
									<TableHead>Estado</TableHead>
									<TableHead>Fecha</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{quotes.map((quote) => (
									<TableRow key={quote.id} className="hover:bg-cp-bg2/40">
										<TableCell colSpan={6} className="p-0">
											<Link
												to={`/quotes/${quote.id}`}
												className="flex items-center gap-3 px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cp-bg"
											>
												<span className="font-mono text-xs w-16 shrink-0">
													{quote.quote_number}
												</span>
												<span className="flex-1 min-w-0 truncate">
													{quote.furniture_name}
												</span>
												<span className="hidden md:inline text-ink2 text-sm w-32 truncate">
													{quote.client?.name ?? "—"}
												</span>
												<span className="ml-auto text-right font-medium tabular-nums w-20">
													{formatCurrency(getSalePrice(quote))}
												</span>
												<span className="w-28 shrink-0 flex justify-start">
													<DashboardQuoteStatusBadge status={quote.status} />
												</span>
												<span className="hidden md:inline text-ink2 text-sm w-24 text-right">
													{format(new Date(quote.created_at), "d MMM yyyy", {
														locale: es,
													})}
												</span>
											</Link>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</>
			)}
		</div>
	);
}
