import type { Database } from "@/shared/types/database";
import type { Material } from "@/shared/types/material";

export type { RecipeCost } from "@/shared/lib/recipeCosting";

type FurnitureTemplate =
	Database["public"]["Tables"]["furniture_templates"]["Row"];
type LaborItem = Database["public"]["Tables"]["labor_items"]["Row"];
type CutPiece = Database["public"]["Tables"]["cut_pieces"]["Row"];

// RecipeItem enriquecido con datos del material (viene del JOIN en la API).
// Para madera se incluyen las medidas porque el cálculo de costo las usa
// (ver computeWoodUsage).
export type RecipeItemWithMaterial = {
	id: string;
	furniture_template_id: string;
	material_id: string;
	quantity: number;
	waste_pct: number;
	quantity_formula?: string | null;
	/** Piezas a cortar definidas para este ítem (solo aplica a placa). */
	cut_pieces?: Pick<
		CutPiece,
		"id" | "name" | "length_cm" | "width_cm" | "quantity"
	>[];
	material: Pick<
		Material,
		| "id"
		| "name"
		| "category"
		| "unit"
		| "price_per_unit"
		| "wood_subtype"
		| "length_cm"
		| "width_cm"
		| "thickness_cm"
	>;
};

export interface FurnitureParam {
	name: string;
	default: number;
}

// Template completo con todos sus items
export type FurnitureTemplateWithItems = FurnitureTemplate & {
	recipe_items: RecipeItemWithMaterial[];
	labor_items: LaborItem[];
};
