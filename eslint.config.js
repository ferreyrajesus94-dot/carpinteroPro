import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// `featureZone` limits cross-feature imports to the target feature's
// public barrel (`src/features/<feature>/index.ts`). Self-imports stay
// allowed through the feature directory so a feature can reach its own
// internal files without opening the seam to other features.
const featureZone = (feature, exceptions = []) => ({
	target: `./src/features/${feature}`,
	from: "./src/features",
	except: [
		`./${feature}`,
		...exceptions.map((name) => `./${name}/index.ts`),
	],
});

const featureBoundaryZones = [
	{
		target: "./src/shared",
		from: "./src/features",
		message:
			"Shared code must not import feature code; move shared contracts to src/shared/.",
	},
	featureZone("auth"),
	featureZone("admin"),
	featureZone("billing"),
  // CRM may import the quotes feature only through its public barrel.
	featureZone("crm"),
  // Dashboard mounts `ProductionPipelineWidget`, so it may import the
  // production feature only through its public barrel.
	featureZone("dashboard", ["production"]),
	featureZone("inventory"),
	featureZone("landing"),
	featureZone("legal"),
	featureZone("onboarding"),
  // Production stays isolated from other features; cross-feature
  // consumers must go through the production barrel.
	featureZone("production"),
  // Quotes may import production through the public barrel for the
  // "Iniciar producción" flow.
	featureZone("quotes", ["production"]),
	featureZone("search"),
  // Recipes needs inventory (materials/price history) and settings
  // (stock alert flag) for the template editor.
	featureZone("recipes", ["inventory", "settings"]),
	featureZone("settings"),
	featureZone("tasks"),
];

export default defineConfig([
	globalIgnores(["dist"]),
	{
		files: ["**/*.{ts,tsx}"],
		plugins: {
			import: importPlugin,
		},
		settings: {
			"import/resolver": {
				typescript: {
					project: "./tsconfig.app.json",
				},
			},
		},
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
		],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
		rules: {
			"import/no-restricted-paths": [
				"error",
				{
					basePath: import.meta.dirname,
					zones: featureBoundaryZones,
				},
			],
		},
	},
	{
		files: ["supabase/functions/**/*.ts"],
		languageOptions: {
			globals: {
				...globals.browser,
				Deno: "readonly",
			},
		},
	},
	{
		files: ["src/shared/ui/**/*.{ts,tsx}"],
		rules: {
			"react-refresh/only-export-components": "off",
		},
	},
	{
		// Guardrail: prevent legacy shadcn HSL tokens from creeping back into the
		// dashboard surface or the shared primitives after the colorize migration.
		// OKLCH (`bg-cp-*`, `text-ink*`, `border-line`, `ring-cp-accent`,
		// `ring-offset-cp-bg`) is the single source of truth per DESIGN.md
		// "The Single Source Rule". Bare `bg-muted` is the only allowed HSL
		// survivor and lives in `Skeleton` per the prior pass; the rule bans every
		// opacity variant of it but never the bare class.
		// Scope kept explicit so other surfaces (inventory, recipes, …) are not
		// swept until their own slices migrate; expand the file list when the
		// next surface comes up for colorize.
		files: [
			"src/features/dashboard/components/Dashboard.tsx",
			"src/features/dashboard/components/KPICards.tsx",
			"src/features/dashboard/components/ActiveQuotesPanel.tsx",
			"src/features/dashboard/components/StatusPieChart.tsx",
			"src/shared/ui/**/*.{ts,tsx}",
		],
		rules: {
			"no-restricted-syntax": [
				"error",
				{
					selector:
						"Literal[value=/\\b(bg-surface|bg-card|bg-background|bg-popover|text-popover-foreground|border-input|text-card-foreground|bg-accent|text-accent-foreground|bg-secondary|text-secondary-foreground|bg-primary|text-primary-foreground|bg-destructive|text-destructive-foreground|bg-ring|ring-offset-background|text-muted-foreground)\\b/]",
					message:
						'Legacy shadcn HSL token (DEPRECATED, see DESIGN.md "The Single Source Rule"). Use OKLCH tokens: bg-cp-surface / bg-cp-bg2 / text-ink / text-ink2 / text-ink3 / border-line / bg-cp-accent / text-cp-accent / ring-cp-accent / ring-offset-cp-bg.',
				},
				{
					selector: "Literal[value=/\\bbg-muted\\/\\d+\\b/]",
					message:
						'Legacy shadcn HSL token with opacity modifier (DEPRECATED, see DESIGN.md "The Single Source Rule"). Use OKLCH token: bg-cp-bg2/N. Bare bg-muted is allowed only in Skeleton.',
				},
			],
		},
	},
]);
