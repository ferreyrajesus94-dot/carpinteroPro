import type { Database } from "@/shared/types/database";
export {
	applyWaste,
	computeRecipeCost,
	resolveItemQuantity,
} from "@/shared/lib/recipeCosting";
export type { RecipeCost } from "@/shared/lib/recipeCosting";
export type {
	FurnitureParam,
	FurnitureTemplateWithItems,
	RecipeItemWithMaterial,
} from "@/shared/types/recipes";

export type FurnitureTemplate =
	Database["public"]["Tables"]["furniture_templates"]["Row"];
export type FurnitureTemplateInsert =
	Database["public"]["Tables"]["furniture_templates"]["Insert"];
export type FurnitureTemplateUpdate =
	Database["public"]["Tables"]["furniture_templates"]["Update"];
export type RecipeItem = Database["public"]["Tables"]["recipe_items"]["Row"];
export type RecipeItemInsert =
	Database["public"]["Tables"]["recipe_items"]["Insert"];
export type LaborItem = Database["public"]["Tables"]["labor_items"]["Row"];
export type LaborItemInsert =
	Database["public"]["Tables"]["labor_items"]["Insert"];
export type CutPiece = Database["public"]["Tables"]["cut_pieces"]["Row"];
export type CutPieceInsert =
	Database["public"]["Tables"]["cut_pieces"]["Insert"];
