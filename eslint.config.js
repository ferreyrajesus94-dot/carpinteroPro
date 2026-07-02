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
	featureZone("recipes"),
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
]);
