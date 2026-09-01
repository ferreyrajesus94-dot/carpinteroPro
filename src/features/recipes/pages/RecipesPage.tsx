import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { useFabAction } from "@/shared/lib/fab";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import { useMaterials } from "@/features/inventory";
import { useAllPriceHistory } from "@/features/inventory";
import { useWorkshopSettings } from "@/features/settings";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/shared/ui/dialog";
import { MuebleList } from "@/features/recipes";
import { MuebleForm } from "@/features/recipes";
import type { FurnitureTemplateWithItems } from "@/shared/types/recipes";
import type { Material } from "@/shared/types/material";
import type { PriceHistoryRow } from "@/shared/types/priceHistory";

export function RecipesPage() {
	const workshopId = useWorkshopId();
	const [formOpen, setFormOpen] = useState(false);
	const [selectedTemplate, setSelectedTemplate] =
		useState<FurnitureTemplateWithItems | null>(null);

	const { data: materials = [] as Material[] } = useMaterials(workshopId);
	const { data: priceHistory = [] as PriceHistoryRow[] } =
		useAllPriceHistory(workshopId);
	const { data: settings } = useWorkshopSettings(workshopId);
	const stockAlertEnabled = Boolean(settings?.stock_alert_enabled);

	function handleEdit(template: FurnitureTemplateWithItems) {
		setSelectedTemplate(template);
		setFormOpen(true);
	}

	function handleFormClose() {
		setFormOpen(false);
		setSelectedTemplate(null);
	}

	function handleNew() {
		setSelectedTemplate(null);
		setFormOpen(true);
	}

	useFabAction(
		"recipes:new",
		useCallback(() => {
			handleNew();
		}, []),
	);

	return (
		<div className="space-y-4">
			<PageHeader
				title="Muebles"
				subtitle="Plantillas de muebles con lista de materiales y costo estimado."
				actions={
					<Button onClick={handleNew}>
						<Plus className="h-4 w-4 mr-2" />
						Nuevo mueble
					</Button>
				}
			/>

			<MuebleList
				onEdit={handleEdit}
				materials={materials}
				priceHistory={priceHistory}
				stockAlertEnabled={stockAlertEnabled}
				workshopSettings={settings ?? null}
			/>

			<Dialog
				open={formOpen}
				onOpenChange={(open) => !open && handleFormClose()}
			>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{selectedTemplate ? "Editar mueble" : "Nuevo mueble"}
						</DialogTitle>
					</DialogHeader>
					<MuebleForm
						template={selectedTemplate}
						onSuccess={handleFormClose}
						onCancel={handleFormClose}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
