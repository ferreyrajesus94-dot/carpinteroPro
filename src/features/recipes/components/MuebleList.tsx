import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
	Pencil,
	Trash2,
	Copy,
	FileText,
	Search,
	AlertTriangle,
	FileDown,
	Package,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/select";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { SectionHowto } from "@/shared/ui/section-howto";
import { EmptyState, LoadingState } from "@/shared/ui/feedback-state";
import {
	useFurnitureTemplates,
	useDeleteFurnitureTemplate,
	useDuplicateFurnitureTemplate,
	useTemplateUsageCounts,
} from "../hooks/useRecipes";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus";
import type { Material } from "@/shared/types/material";
import type { PriceHistoryRow } from "@/shared/types/priceHistory";
import type { WorkshopSettings } from "@/shared/types/workshopSettings";
import { FurnitureCostSparkline } from "./FurnitureCostSparkline";
import { computeStockShortages } from "../lib/stockCheck";
import { generateTechnicalSheetPDF } from "../lib/pdf";
import { computeRecipeCost } from "../types";
import { formatARS } from "@/shared/lib/utils";
import type { FurnitureTemplateWithItems } from "../types";

interface MuebleListProps {
	onEdit: (template: FurnitureTemplateWithItems) => void;
	materials: Material[];
	priceHistory: PriceHistoryRow[];
	stockAlertEnabled: boolean;
	workshopSettings: WorkshopSettings | null;
}

export function MuebleList({
	onEdit,
	materials,
	priceHistory,
	stockAlertEnabled,
	workshopSettings,
}: MuebleListProps) {
	const workshopId = useWorkshopId();
	const isOnline = useOnlineStatus();
	const { data: templates = [], isLoading } = useFurnitureTemplates(workshopId);
	const { data: usageCounts = {} } = useTemplateUsageCounts(workshopId);
	const deleteMutation = useDeleteFurnitureTemplate(workshopId);
	const duplicateMutation = useDuplicateFurnitureTemplate(workshopId);
	const [deleteTarget, setDeleteTarget] =
		useState<FurnitureTemplateWithItems | null>(null);
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("__all__");

	const categories = useMemo(() => {
		const set = new Set<string>();
		for (const t of templates) if (t.category) set.add(t.category);
		return Array.from(set).sort();
	}, [templates]);

	const filteredTemplates = useMemo(() => {
		const q = search.trim().toLowerCase();
		return templates.filter((t) => {
			if (categoryFilter !== "__all__" && t.category !== categoryFilter)
				return false;
			if (!q) return true;
			const haystack = [
				t.name,
				t.category ?? "",
				...(t.tags ?? []),
				t.notes ?? "",
			]
				.join(" ")
				.toLowerCase();
			return haystack.includes(q);
		});
	}, [templates, search, categoryFilter]);

	if (isLoading) {
		return <LoadingState label="Cargando muebles..." />;
	}

	if (templates.length === 0) {
		return (
			<EmptyState
				variant="empty-feature"
				icon={Package}
				title="Sin muebles todavía"
				description="Creá tu primer mueble para usarlo como plantilla en presupuestos."
			/>
		);
	}

	return (
		<>
			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
				title="Eliminar mueble"
				description={`¿Seguro que querés eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
				onConfirm={() => {
					if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
					setDeleteTarget(null);
				}}
				isPending={deleteMutation.isPending}
			/>

			<SectionHowto
				storageKey="muebles"
				steps={[
					"Cada mueble es una receta: lista de materiales + tiempo + extras.",
					"El costo se recalcula solo cuando cambia el precio de un material.",
					"Usá estas plantillas al crear un presupuesto para traer el costo ya calculado.",
				]}
			/>

			<div className="flex flex-col sm:flex-row gap-2">
				<div className="relative flex-1">
					<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Buscar por nombre, tag, categoría..."
						className="pl-8"
					/>
				</div>
				{categories.length > 0 && (
					<Select value={categoryFilter} onValueChange={setCategoryFilter}>
						<SelectTrigger className="sm:w-48">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__all__">Todas las categorías</SelectItem>
							{categories.map((c) => (
								<SelectItem key={c} value={c}>
									{c}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</div>

			{filteredTemplates.length === 0 && (
				<p className="py-6 text-center text-sm text-muted-foreground">
					Sin resultados.
				</p>
			)}

			{/* Grid responsive: 1-col mobile / 2-col tablet / 3-col desktop */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{filteredTemplates.map((template) => {
					const { total } = computeRecipeCost(
						template.recipe_items,
						template.labor_items,
					);
					const usedIn = usageCounts[template.id] ?? 0;
					const dims = [
						template.height_cm,
						template.width_cm,
						template.depth_cm,
					].filter((v) => v != null);
					const shortages = stockAlertEnabled
						? computeStockShortages(template.recipe_items, materials)
						: [];

					return (
						<div
							key={template.id}
							className="rounded-lg border border-line bg-cp-surface/50 hover:border-line-2 transition-colors overflow-hidden flex flex-col"
						>
							{/* Thumbnail */}
							<div className="w-full aspect-square bg-cp-bg2 relative flex items-center justify-center border-b border-line overflow-hidden">
								{template.photo_url ? (
									<img
										src={template.photo_url}
										alt=""
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
										<Package className="h-10 w-10" />
									</div>
								)}
								{shortages.length > 0 && (
									<div className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1">
										<AlertTriangle className="h-4 w-4" />
									</div>
								)}
							</div>

							{/* Card content */}
							<div className="flex-1 flex flex-col p-4">
								<div className="flex-1">
									<h3 className="font-medium text-sm line-clamp-2 mb-2">
										{template.name}
									</h3>

									{/* Category chip */}
									{template.category && (
										<div className="mb-3">
											<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cp-accent/10 text-cp-accent">
												{template.category}
											</span>
										</div>
									)}

									{/* Description */}
									<div className="space-y-1 mb-3 text-xs text-muted-foreground">
										<p>
											{template.recipe_items.length} material
											{template.recipe_items.length !== 1 ? "es" : ""}
										</p>
										{dims.length === 3 && (
											<p>
												{template.height_cm}×{template.width_cm}×
												{template.depth_cm} cm
											</p>
										)}
									</div>
								</div>

								{/* Cost in font-display */}
								<div className="mb-4 pt-3 border-t border-line">
									<p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">
										Costo estimado
									</p>
									<div className="flex items-baseline justify-between">
										<p className="font-display text-lg font-semibold text-ink">
											{formatARS(total)}
										</p>
										<FurnitureCostSparkline
											items={template.recipe_items}
											priceHistory={priceHistory}
										/>
									</div>
								</div>

								{/* Action buttons */}
								<div className="grid grid-cols-2 gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={!isOnline}
										onClick={() => onEdit(template)}
										className="text-xs"
									>
										<Pencil className="h-3 w-3 mr-1" /> Editar
									</Button>
									<Button
										variant="outline"
										size="sm"
										asChild
										disabled={!isOnline}
										className="text-xs"
									>
										<Link to={`/quotes/new?template=${template.id}`}>
											<FileText className="h-3 w-3 mr-1" /> Usar
										</Link>
									</Button>
								</div>

								{/* Additional actions dropdown */}
								<div className="grid grid-cols-3 gap-1 mt-2">
									<Button
										variant="ghost"
										size="icon"
										disabled={!isOnline || duplicateMutation.isPending}
										onClick={() => duplicateMutation.mutate(template.id)}
										title="Duplicar"
										className="h-8"
									>
										<Copy className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onClick={() =>
											generateTechnicalSheetPDF({
												template,
												settings: workshopSettings,
											})
										}
										title="Exportar PDF"
										className="h-8"
									>
										<FileDown className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										disabled={!isOnline}
										onClick={() => setDeleteTarget(template)}
										title="Eliminar"
										className="h-8"
									>
										<Trash2 className="h-4 w-4 text-destructive" />
									</Button>
								</div>

								{/* Usage info */}
								{usedIn > 0 && (
									<p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-line">
										<Link
											to={`/quotes?template=${template.id}`}
											className="underline hover:text-foreground"
										>
											Usado en {usedIn} presupuesto{usedIn !== 1 ? "s" : ""}
										</Link>
									</p>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}
