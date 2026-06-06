import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

const featureZone = (feature, exceptions = []) => ({
	target: `./src/features/${feature}`,
	from: "./src/features",
	except: [`./${feature}`, ...exceptions.map((name) => `./${name}`)],
});

const featureBoundaryZones = [
	{
		target: "./src/shared",
		from: "./src/features",
		message:
			"Shared code must not import feature code; move shared contracts to src/shared/.",
	},
	featureZone("auth"),
	featureZone("billing"),
	// SDD9 WU6 complete: CRM no longer imports from quotes feature.
	featureZone("crm"),
	featureZone("dashboard"),
	featureZone("inventory"),
	featureZone("landing"),
	featureZone("legal"),
	featureZone("onboarding"),
	// SDD9 complete: quotes has no remaining feature exceptions.
	featureZone("quotes"),
	// SDD9 WU7 complete: recipes no longer imports inventory or settings.
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
