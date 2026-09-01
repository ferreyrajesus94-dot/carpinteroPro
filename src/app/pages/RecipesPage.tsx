// Re-export shim: the canonical implementation lives in the recipes feature.
// The router still imports `./pages/RecipesPage` relative to this file, so we
// forward to the feature location instead of duplicating the component here.
export { RecipesPage } from "@/features/recipes/pages/RecipesPage";
