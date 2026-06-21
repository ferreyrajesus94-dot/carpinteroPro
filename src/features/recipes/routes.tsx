import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { useFabAction } from "@/shared/lib/fab";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/shared/ui/dialog";
import { MuebleList } from "./components/MuebleList";
import { MuebleForm } from "./components/MuebleForm";
import type { FurnitureTemplateWithItems } from "./types";

export function RecipesRoutes() {
	const [formOpen, setFormOpen] = useState(false);
	const [selectedTemplate, setSelectedTemplate] =
		useState<FurnitureTemplateWithItems | null>(null);

	function handleEdit(template: FurnitureTemplateWithItems) {
		setSelectedTemplate(template);
		setFormOpen(true);
	}

	function handleFormClose() {
		setFormOpen(false);
		setSelectedTemplate(null);
	}

	useFabAction(
		"recipes:new",
		useCallback(() => {
			setSelectedTemplate(null);
			setFormOpen(true);
		}, []),
	);

	return (
		<div className="space-y-4">
			<PageHeader
				title="Muebles"
				subtitle="Plantillas de muebles con lista de materiales y costo estimado."
				actions={
					<Button
						onClick={() => {
							setSelectedTemplate(null);
							setFormOpen(true);
						}}
					>
						<Plus className="h-4 w-4 mr-2" />
						Nuevo mueble
					</Button>
				}
			/>

			{/* MuebleList requires materials/priceHistory/settings from app page */}
			<MuebleList
				onEdit={handleEdit}
				materials={[]}
				priceHistory={[]}
				stockAlertEnabled={false}
				workshopSettings={null}
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
