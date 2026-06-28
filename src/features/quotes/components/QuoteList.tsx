import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
	Plus,
	Pencil,
	Trash2,
	FileText,
	ChevronLeft,
	ChevronRight,
	LayoutList,
	LayoutGrid,
} from "lucide-react";
import {
	DndContext,
	MouseSensor,
	useSensor,
	useSensors,
	useDroppable,
	useDraggable,
	type DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/shared/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/select";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { SectionHowto } from "@/shared/ui/section-howto";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState, LoadingState } from "@/shared/ui/feedback-state";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/ui/table";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus";
import { useWorkshopSettings } from "@/shared/hooks/useWorkshopSettings";
import {
	useQuotes,
	useQuotesPaginated,
	useDeleteQuote,
	useUpdateQuoteStatus,
} from "../hooks/useQuotes";
import { PAGE_SIZE } from "../api/quotes";
import { formatCurrency } from "@/shared/lib/formatters";
import {
	QUOTE_STATUS_LABELS,
	QUOTE_STATUS_COLORS,
	type QuoteStatus,
} from "../types";
import { QuoteStatusBadge } from "./QuoteStatusBadge";
import { calculateQuote } from "../lib/calculator";
import { ProductionStartReviewDialog } from "./ProductionStartReviewDialog";
import type { QuoteWithExtras } from "../types";

const STATUS_ORDER: QuoteStatus[] = [
	"presupuesto",
	"enviado",
	"aprobado",
	"en_produccion",
	"entregado",
	"cancelado",
];

function DroppableColumn({
	status,
	children,
}: {
	status: QuoteStatus;
	children: React.ReactNode;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: status });
	return (
		<div
			ref={setNodeRef}
			className={`space-y-2 min-h-[120px] rounded-md p-1 transition-colors ${isOver ? "bg-cp-accent/10 ring-1 ring-cp-accent" : ""}`}
		>
			{children}
		</div>
	);
}

function DraggableCard({
	quote,
	status,
	salePrice,
	isOnline,
	onChangeStatus,
}: {
	quote: QuoteWithExtras;
	status: QuoteStatus;
	salePrice: number;
	isOnline: boolean;
	onChangeStatus: (id: string, next: QuoteStatus) => void;
}) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: quote.id,
		data: { status },
	});
	return (
		<div
			ref={setNodeRef}
			className={`bg-surface border border-line rounded-md p-3 hover:border-cp-accent transition-colors ${isDragging ? "opacity-40" : ""}`}
		>
			<div className="flex items-center justify-between mb-1">
				<span className="font-mono text-xs text-ink2">
					{quote.quote_number}
				</span>
				<Link
					to={`/quotes/${quote.id}`}
					className="text-muted-foreground hover:text-foreground text-xs"
					title="Editar"
				>
					↗
				</Link>
			</div>
			{/* Desktop drag handle: toda la card arrastrable */}
			<div
				className="hidden sm:block cursor-move"
				{...attributes}
				{...listeners}
			>
				<p className="text-sm font-medium line-clamp-2 mb-1">
					{quote.furniture_name}
				</p>
				<p className="text-xs text-muted-foreground truncate mb-2">
					{quote.client?.name ?? "Sin cliente"}
				</p>
				<p className="font-display font-semibold text-base">
					{formatCurrency(salePrice)}
				</p>
			</div>
			{/* Mobile: sin drag, selector de estado */}
			<div className="sm:hidden">
				<p className="text-sm font-medium line-clamp-2 mb-1">
					{quote.furniture_name}
				</p>
				<p className="text-xs text-muted-foreground truncate mb-2">
					{quote.client?.name ?? "Sin cliente"}
				</p>
				<div className="flex items-center justify-between gap-2">
					<p className="font-display font-semibold text-base">
						{formatCurrency(salePrice)}
					</p>
					<Select
						value={status}
						onValueChange={(v) => onChangeStatus(quote.id, v as QuoteStatus)}
						disabled={!isOnline}
					>
						<SelectTrigger className="h-8 w-36 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STATUS_ORDER.map((s) => (
								<SelectItem key={s} value={s} className="text-xs">
									{QUOTE_STATUS_LABELS[s]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}

export function QuoteList() {
	const workshopId = useWorkshopId();
	const isOnline = useOnlineStatus();
	const [view, setView] = useState<"lista" | "pipeline">("lista");
	const [page, setPage] = useState(0);
	const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
	const { data: allQuotes = [] } = useQuotes(workshopId);
	const {
		data: result,
		isLoading,
		isError,
		refetch,
	} = useQuotesPaginated(workshopId, page);
	const { data: workshopSettings } = useWorkshopSettings(workshopId);
	const deleteMutation = useDeleteQuote(workshopId);
	const updateStatusMutation = useUpdateQuoteStatus(workshopId);
	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		quoteNumber: string;
	} | null>(null);
	const [productionStartTarget, setProductionStartTarget] = useState<{
		id: string;
		quoteNumber: string;
	} | null>(null);
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
	);

	function moveQuoteToStatus(id: string, next: QuoteStatus) {
		const quote = allQuotes.find((q) => q.id === id);
		if (!quote || quote.status === next) return;
		if (quote.status === "aprobado" && next === "en_produccion") {
			setProductionStartTarget({
				id: quote.id,
				quoteNumber: quote.quote_number,
			});
			return;
		}
		// Use status-only path that preserves snapshots/extras
		updateStatusMutation.mutate({ id: quote.id, status: next });
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over) return;
		const next = over.id as QuoteStatus;
		const prev = active.data.current?.status as QuoteStatus | undefined;
		if (prev && prev !== next) moveQuoteToStatus(active.id as string, next);
	}

	const quotes = result?.data ?? [];
	const totalCount = result?.count ?? 0;
	const totalPages = Math.ceil(totalCount / PAGE_SIZE);

	// Grouped by status para Pipeline
	const grouped = useMemo(
		() =>
			STATUS_ORDER.reduce<Record<QuoteStatus, QuoteWithExtras[]>>(
				(acc, status) => {
					acc[status] = allQuotes.filter((q) => q.status === status);
					return acc;
				},
				{} as Record<QuoteStatus, QuoteWithExtras[]>,
			),
		[allQuotes],
	);

	// Status chips con counts para Lista
	const statusChips = useMemo(
		() => [
			{ value: "all" as const, label: "Todos", count: allQuotes.length },
			...STATUS_ORDER.map((s) => ({
				value: s,
				label: QUOTE_STATUS_LABELS[s],
				count: grouped[s].length,
			})),
		],
		[allQuotes.length, grouped],
	);

	// Filtered quotes para Pipeline view
	const listaQuotes =
		statusFilter === "all"
			? quotes
			: quotes.filter((q) => q.status === statusFilter);

	if (isError) {
		return (
			<ErrorState
				title="Error al cargar los presupuestos"
				description="Revisá tu conexión e intentá de nuevo."
				action={
					<button
						type="button"
						onClick={() => refetch()}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-cp-surface px-3 text-xs font-medium text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
					>
						Reintentar
					</button>
				}
			/>
		);
	}

	if (isLoading && !result) {
		return <LoadingState label="Cargando presupuestos..." />;
	}

	return (
		<div className="space-y-4 p-4">
			{productionStartTarget && (
				<ProductionStartReviewDialog
					key={productionStartTarget.id}
					quoteId={productionStartTarget.id}
					quoteNumber={productionStartTarget.quoteNumber}
					open={productionStartTarget !== null}
					onOpenChange={(open) => {
						if (!open) setProductionStartTarget(null);
					}}
					autoStockDiscount={workshopSettings?.auto_stock_discount ?? true}
				/>
			)}

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
				title="Eliminar presupuesto"
				description={`¿Seguro que querés eliminar el presupuesto ${deleteTarget?.quoteNumber}? Esta acción no se puede deshacer.`}
				onConfirm={() => {
					if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
					setDeleteTarget(null);
				}}
				isPending={deleteMutation.isPending}
			/>

			<PageHeader
				title="Presupuestos"
				actions={
					<Button asChild disabled={!isOnline}>
						<Link to="/quotes/new">
							<Plus className="h-4 w-4 mr-2" />
							Nuevo
						</Link>
					</Button>
				}
			/>

			<SectionHowto
				storageKey="presupuestos"
				steps={[
					"Cada presupuesto pasa por etapas: Presupuesto → Enviado → Aprobado → Producción → Entregado.",
					"En vista Pipeline, arrastrás las tarjetas entre columnas (desktop) o usás el selector de estado dentro de cada tarjeta (mobile).",
					"Al aprobar un presupuesto, se genera automáticamente el contrato listo para firmar.",
				]}
			/>

			{/* View toggle */}
			<div className="flex items-center gap-1 p-1 bg-cp-bg2 border border-line rounded-lg w-fit">
				{(["lista", "pipeline"] as const).map((v) => (
					<button
						key={v}
						onClick={() => setView(v)}
						className={`h-8 px-3 rounded-md text-xs font-medium capitalize transition-colors flex items-center gap-2 ${
							view === v ? "bg-surface text-ink shadow-sm" : "text-ink3"
						}`}
					>
						{v === "lista" ? (
							<LayoutList className="h-3.5 w-3.5" />
						) : (
							<LayoutGrid className="h-3.5 w-3.5" />
						)}
						{v}
					</button>
				))}
			</div>

			{allQuotes.length === 0 ? (
				<EmptyState
					icon={FileText}
					title="Sin presupuestos todavía"
					description="Armá el primer presupuesto desde una plantilla de mueble o a medida."
					action={
						<Button asChild size="sm" disabled={!isOnline}>
							<Link to="/quotes/new">+ Nuevo presupuesto</Link>
						</Button>
					}
				/>
			) : view === "lista" ? (
				// LISTA VIEW
				<>
					{/* Status chips */}
					<div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
						{statusChips.map(({ value, label, count }) => (
							<button
								key={value}
								onClick={() => setStatusFilter(value)}
								className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
									statusFilter === value
										? "bg-cp-accent text-white"
										: "bg-cp-bg2 text-ink2 hover:bg-cp-accent/10"
								}`}
							>
								{label}{" "}
								<span className="ml-1 text-[10px] opacity-75">({count})</span>
							</button>
						))}
					</div>

					{listaQuotes.length === 0 && (
						<p className="py-6 text-center text-sm text-muted-foreground">
							Sin resultados en este estado.
						</p>
					)}

					{/* Mobile: cards */}
					<div className="sm:hidden space-y-2">
						{listaQuotes.map((q) => {
							const { salePrice } = calculateQuote({
								recipeCost: q.recipe_cost,
								extras: q.extras.map((e) => ({
									amount: e.amount,
									show_in_quote: e.show_in_quote,
								})),
								marginMode: q.margin_mode,
								marginPct: q.margin_pct,
							});
							return (
								<div
									key={q.id}
									className="rounded-md border border-line bg-surface/50 p-3 space-y-2"
								>
									<div className="flex items-center justify-between">
										<span className="font-mono font-medium text-sm text-ink2">
											{q.quote_number}
										</span>
										<QuoteStatusBadge status={q.status} />
									</div>
									<p className="text-sm font-medium line-clamp-2">
										{q.furniture_name}
									</p>
									<p className="text-xs text-muted-foreground">
										{q.client?.name ?? "Sin cliente"}
									</p>
									<div className="flex items-center justify-between">
										<span className="font-display font-semibold text-base">
											{formatCurrency(salePrice)}
										</span>
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												asChild
												className="h-8 w-8"
											>
												<Link to={`/quotes/${q.id}/contract`}>
													<FileText className="h-4 w-4" />
												</Link>
											</Button>
											<Button
												variant="ghost"
												size="icon"
												asChild
												disabled={!isOnline}
												className="h-8 w-8"
											>
												<Link to={`/quotes/${q.id}`}>
													<Pencil className="h-4 w-4" />
												</Link>
											</Button>
											<Button
												variant="ghost"
												size="icon"
												disabled={!isOnline}
												onClick={() =>
													setDeleteTarget({
														id: q.id,
														quoteNumber: q.quote_number,
													})
												}
												className="h-8 w-8"
											>
												<Trash2 className="h-4 w-4 text-destructive" />
											</Button>
										</div>
									</div>
								</div>
							);
						})}
					</div>

					{/* Desktop: table */}
					<div className="hidden sm:block rounded-lg border border-line overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>N°</TableHead>
									<TableHead>Cliente</TableHead>
									<TableHead>Mueble</TableHead>
									<TableHead className="text-right">Total</TableHead>
									<TableHead>Estado</TableHead>
									<TableHead className="text-right">Acciones</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{listaQuotes.map((q) => {
									const { salePrice } = calculateQuote({
										recipeCost: q.recipe_cost,
										extras: q.extras.map((e) => ({
											amount: e.amount,
											show_in_quote: e.show_in_quote,
										})),
										marginMode: q.margin_mode,
										marginPct: q.margin_pct,
									});
									return (
										<TableRow key={q.id}>
											<TableCell className="font-mono font-medium">
												{q.quote_number}
											</TableCell>
											<TableCell>
												{q.client?.name ?? (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell>{q.furniture_name}</TableCell>
											<TableCell className="text-right font-display font-semibold">
												{formatCurrency(salePrice)}
											</TableCell>
											<TableCell>
												<QuoteStatusBadge status={q.status} />
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													<Button
														variant="ghost"
														size="icon"
														asChild
														className="h-8 w-8"
													>
														<Link to={`/quotes/${q.id}/contract`}>
															<FileText className="h-4 w-4" />
														</Link>
													</Button>
													<Button
														variant="ghost"
														size="icon"
														asChild
														disabled={!isOnline}
														className="h-8 w-8"
													>
														<Link to={`/quotes/${q.id}`}>
															<Pencil className="h-4 w-4" />
														</Link>
													</Button>
													<Button
														variant="ghost"
														size="icon"
														disabled={!isOnline}
														onClick={() =>
															setDeleteTarget({
																id: q.id,
																quoteNumber: q.quote_number,
															})
														}
														className="h-8 w-8"
													>
														<Trash2 className="h-4 w-4 text-destructive" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>

					{totalPages > 1 && (
						<div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
							<span>
								{totalCount} presupuestos — página {page + 1} de {totalPages}
							</span>
							<div className="flex gap-1">
								<Button
									variant="outline"
									size="icon"
									onClick={() => setPage((p) => p - 1)}
									disabled={page === 0}
									className="h-8 w-8"
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									onClick={() => setPage((p) => p + 1)}
									disabled={page >= totalPages - 1}
									className="h-8 w-8"
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</>
			) : (
				// PIPELINE VIEW
				<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
					<div className="overflow-x-auto -mx-4 px-4 pb-4 no-scrollbar">
						<div className="flex gap-3 min-w-max">
							{STATUS_ORDER.map((status) => {
								const cards = grouped[status];
								return (
									<div key={status} className="w-72 flex-shrink-0">
										<div className="mb-2 pb-2 border-b border-line">
											<div className="flex items-center gap-2">
												<span
													className={`px-2.5 py-1 rounded-full text-xs font-medium ${QUOTE_STATUS_COLORS[status]}`}
												>
													{QUOTE_STATUS_LABELS[status]}
												</span>
												<span className="text-xs font-mono text-ink2">
													{cards.length}
												</span>
											</div>
										</div>

										<DroppableColumn status={status}>
											{cards.length === 0 ? (
												<div className="text-center py-6 text-xs text-muted-foreground">
													Vacío
												</div>
											) : (
												cards.map((q) => {
													const { salePrice } = calculateQuote({
														recipeCost: q.recipe_cost,
														extras: q.extras.map((e) => ({
															amount: e.amount,
															show_in_quote: e.show_in_quote,
														})),
														marginMode: q.margin_mode,
														marginPct: q.margin_pct,
													});
													return (
														<DraggableCard
															key={q.id}
															quote={q}
															status={status}
															salePrice={salePrice}
															isOnline={isOnline}
															onChangeStatus={moveQuoteToStatus}
														/>
													);
												})
											)}
										</DroppableColumn>
									</div>
								);
							})}
						</div>
					</div>
				</DndContext>
			)}
		</div>
	);
}
