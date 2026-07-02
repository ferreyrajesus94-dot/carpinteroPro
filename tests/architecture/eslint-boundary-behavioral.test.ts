import { describe, it, expect } from "vitest";
// Use the Linter class directly to lint inline source against the
// project's `eslint.config.js`. This complements the structural test
// by proving the rule actually fires for cross-feature internals.
import { Linter } from "eslint";
import type { Linter as LinterType } from "eslint";
import * as importPlugin from "eslint-plugin-import";
// The project's `eslint.config.js` is a JS module without a matching
// `.d.ts`. We import it as `unknown` and cast locally so the test can
// run against the real config without adding a type declaration.
// @ts-expect-error -- no .d.ts for the project's JS eslint config
import eslintConfig from "../../eslint.config.js";

// Minimal `process` type: the app tsconfig does not include Node
// globals, but vitest runs this file in Node so `cwd()` is available.
declare const process: { cwd(): string };

type FlatConfigBlock = {
	files?: string[];
	plugins?: Record<string, unknown>;
	rules?: Record<string, unknown>;
	[key: string]: unknown;
};

/**
 * Behavioral check for the `featureZone` ESLint boundary helper.
 * The structural test pins the config shape; this file proves the
 * rule actually rejects cross-feature internals and allows the
 * intended barrel-only seams.
 */

const NOOP_RULES = {
	"react-refresh/only-export-components": "off",
	"react-hooks/rules-of-hooks": "off",
	"@typescript-eslint/no-unused-vars": "off",
	"@typescript-eslint/no-unused-expressions": "off",
	"no-unused-vars": "off",
	"no-undef": "off",
	"no-unused-expressions": "off",
};

function makeLinter(): { linter: LinterType; cfg: FlatConfigBlock[] } {
	const linter = new Linter();
	// Register only the import restriction rule so the lint stays fast
	// and the test isolates the boundary behavior.
	const rawConfig = eslintConfig as unknown;
	const cfgArray: FlatConfigBlock[] = Array.isArray(rawConfig)
		? (rawConfig as FlatConfigBlock[])
		: [rawConfig as FlatConfigBlock];
	const cfg: FlatConfigBlock[] = cfgArray.map((block) => ({
		...block,
		plugins: { ...(block.plugins ?? {}), import: importPlugin },
		rules: { ...(block.rules ?? {}), ...NOOP_RULES },
	}));
	return { linter, cfg };
}

// Absolute paths let ESLint match the file against the configured
// project root. `process.cwd()` keeps the test portable across local
// machines and CI.
const PROJECT_ROOT = process.cwd();
const FILENAMES = {
	dashboard: `${PROJECT_ROOT}/src/features/dashboard/components/Dashboard.tsx`,
	quotes: `${PROJECT_ROOT}/src/features/quotes/components/QuoteActions.tsx`,
	production: `${PROJECT_ROOT}/src/features/production/components/ProductionPipelineWidget.tsx`,
};

function lintSource(
	linter: LinterType,
	cfg: FlatConfigBlock[],
	filename: string,
	source: string,
): LinterMessage[] {
	// The flat-config type is stricter than these synthetic blocks, so
	// we cast once and keep the test focused on the rule output.
	return (
		linter.verify as (
			text: string,
			config: unknown,
			options: { filename: string },
		) => LinterMessage[]
	)(
		source,
		[
			...cfg,
			{
				files: ["**/*.{ts,tsx}"],
				languageOptions: {
					ecmaVersion: 2022,
					sourceType: "module",
					parserOptions: { ecmaFeatures: { jsx: true } },
				},
			},
		],
		{ filename },
	);
}

type LinterMessage = { ruleId: string | null; message: string };

function filterImportNoRestrictedPaths(
	messages: LinterMessage[],
): LinterMessage[] {
	return messages.filter((m) => m.ruleId === "import/no-restricted-paths");
}

describe("ESLint boundary — behavioral contract", () => {
  it("dashboard importing the production barrel is allowed", () => {
    const { linter, cfg } = makeLinter();
		const src = 'import { ProductionPipelineWidget } from "@/features/production";\n';
		const messages = lintSource(linter, cfg, FILENAMES.dashboard, src);
		const restricted = filterImportNoRestrictedPaths(messages);
		expect(restricted).toEqual([]);
	});

  it("dashboard importing a production internal file is blocked", () => {
    const { linter, cfg } = makeLinter();
		const src =
			'import { useProductionOrders } from "@/features/production/hooks/useProductionOrders";\n';
		const messages = lintSource(linter, cfg, FILENAMES.dashboard, src);
		const restricted = filterImportNoRestrictedPaths(messages);
		expect(restricted.length).toBeGreaterThan(0);
		expect(restricted[0].message).toMatch(/imported in restricted zone/);
	});

  it("dashboard importing a production component directly is blocked", () => {
    const { linter, cfg } = makeLinter();
		const src =
			'import { ProductionPipelineWidget } from "@/features/production/components/ProductionPipelineWidget";\n';
		const messages = lintSource(linter, cfg, FILENAMES.dashboard, src);
		const restricted = filterImportNoRestrictedPaths(messages);
		expect(restricted.length).toBeGreaterThan(0);
	});

  it("production self-imports inside the feature are allowed", () => {
    const { linter, cfg } = makeLinter();
		const src =
			'import { useProductionOrders } from "@/features/production/hooks/useProductionOrders";\n';
		const messages = lintSource(linter, cfg, FILENAMES.production, src);
		const restricted = filterImportNoRestrictedPaths(messages);
		expect(restricted).toEqual([]);
	});

  it("quotes importing the production barrel is allowed", () => {
    const { linter, cfg } = makeLinter();
		const src = 'import { useStartProductionOrder } from "@/features/production";\n';
		const messages = lintSource(linter, cfg, FILENAMES.quotes, src);
		const restricted = filterImportNoRestrictedPaths(messages);
		expect(restricted).toEqual([]);
	});

  it("quotes importing a production internal file is blocked", () => {
    const { linter, cfg } = makeLinter();
		const src =
			'import { useStartProductionOrder } from "@/features/production/hooks/useProductionOrders";\n';
		const messages = lintSource(linter, cfg, FILENAMES.quotes, src);
		const restricted = filterImportNoRestrictedPaths(messages);
		expect(restricted.length).toBeGreaterThan(0);
	});
});
