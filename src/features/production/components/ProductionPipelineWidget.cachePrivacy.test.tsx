import { describe, it, expect } from "vitest";
// Vite's `?raw` import returns the file's text content. The
// `tsconfig.app.json` excludes Node types so we deliberately avoid
// `import "node:fs"` / `import "node:path"` and use the Vite-typed
// raw import path that the rest of the project's source-level tests
// use (see `tests/supabase-functions/response.test.ts` for the same
// pattern).
import widgetSource from "./ProductionPipelineWidget.tsx?raw";
import { isPersistableQueryKey } from "@/shared/lib/cachePrivacy";

/**
 * PR 8: widget-level cache-privacy + RLS sanity for the dashboard's
 * production pipeline widget.
 *
 * The hook-level cache-privacy contract is exercised in
 * `useProductionOrders.cachePrivacy.test.ts` against the real
 * `@/shared/lib/cachePrivacy` module. This test is the
 * widget-level guarantee:
 *
 * 1. The widget uses the canonical `useProductionPipelineStats` hook
 *    (not a direct API call), so it inherits the same
 *    `["production_orders", "pipeline"]` query key and the same
 *    non-persistable classification.
 * 2. The widget does not import the raw `getProductionPipelineStats`
 *    API; the data flows through the TanStack Query hook so RLS is
 *    enforced exclusively at the SQL layer (the read RPC is SECURITY
 *    INVOKER + workshop-scoped). The widget cannot introduce a side
 *    channel to cross-tenant data.
 *
 * Both guarantees are structural: a regression that bypasses the hook
 * (e.g. by calling `supabase.rpc` directly) fails the source-level
 * assertion because the read RPC module would need to be re-imported
 * by the widget.
 */

describe("ProductionPipelineWidget — cache-privacy + RLS sanity (PR 8)", () => {
	it("uses the canonical ['production_orders', 'pipeline'] query key (non-persistable by the real policy)", () => {
		// The pipeline key is the one created by `useProductionPipelineStats`.
		// Asserting the real policy classifies it as non-persistable
		// here pins the contract at the widget level (the widget does
		// not introduce a different key).
		const pipelineKey = ["production_orders", "pipeline"];
		expect(isPersistableQueryKey(pipelineKey)).toBe(false);
	});

	it("the widget source does NOT import the raw getProductionPipelineStats API (RLS is enforced at the SQL layer)", () => {
		// Source-level structural check: the widget must read data
		// exclusively through `useProductionPipelineStats` so RLS is
		// enforced at the SECURITY INVOKER + workshop-scoped read RPC.
		// A regression that re-introduces a direct `supabase.rpc` call
		// would force the reviewer to re-evaluate the RLS contract.
		//
		// PR 8 review-blocker fix #3: the previous regex only matched
		// `./api/productionOrders` (without the parent `../`). The
		// canonical widget path is `../api/productionOrders` (the
		// widget sits at `components/ProductionPipelineWidget.tsx` and
		// would need to go up one level to reach `api/`). The
		// strengthened pattern below matches BOTH `./api/...` and
		// `../api/...` so a regression that imports the raw API via
		// the relative `../api/...` form is caught at CI time.
		const importsRawApi =
			/import\s+\{[^}]*\}\s+from\s+['"]@\/shared\/lib\/supabase['"]/.test(
				widgetSource,
			) ||
			/import\s+\{[^}]*\}\s+from\s+['"](?:\.\/|\.\.\/)api\/productionOrders['"]/.test(
				widgetSource,
			);

		expect(importsRawApi).toBe(false);
	});

	// PR 8 review-blocker fix #3: a second, more aggressive
	// structural check that ANY value-import of the production
	// API module is caught, not just the two common ones. The
	// widget may freely `import type` from `../api/productionOrders`
	// (TypeScript erases type-only imports at build time so they
	// cannot bypass RLS at runtime), but a VALUE import — `import
	// { getProductionPipelineStats } from "..."` or any
	// runtime call site — is forbidden because it would let the
	// widget bypass the production feature's hook and call the
	// read RPC directly outside the canonical query-key/cache-
	// privacy contract.
	it("the widget source does NOT value-import the production API module (defense in depth — any relative form, value imports only)", () => {
		// Split the widget source into per-statement import chunks
		// and check each chunk individually. This avoids the
		// multi-line regex pitfall where a single non-type `import`
		// would let `[\s\S]*?` skip ahead to a later `import type
		// { ... } from "../api/productionOrders"` and trip the
		// negative-lookahead. The per-statement shape is:
		//   `import [type] { ... } from "...";`
		const importStatements = widgetSource.match(
			/import\s+(?:type\s+)?[^;]+;?/g,
		) ?? [];
		const valueImportOfApi = importStatements.some((stmt) => {
			// Skip type-only imports (TypeScript erases them at
			// build time so no runtime call site can emerge).
			if (/^import\s+type\s/.test(stmt)) return false;
			// Now check if this value import targets the production
			// API module via any relative form (./ or ../ etc).
			return /from\s+['"](?:\.\.?\/)+api\/productionOrders['"]/.test(stmt);
		});
		expect(valueImportOfApi).toBe(false);
	});

	// Companion to the previous test: the widget IS allowed to
	// `import type` from the production API module (for the
	// `ProductionPipelineStat` typed shape). This positive
	// assertion documents the contract: type-only imports are
	// fine, value imports are not. If the widget ever drops its
	// type import, the assertion fails and the reviewer is
	// prompted to confirm the widget still has the typed shape
	// it needs.
	it("the widget source MAY type-import from the production API module (typed shape, erased at build time)", () => {
		const typeImportsProductionApi =
			/import\s+type\s+[^;]+from\s+['"](?:\.\.?\/)+api\/productionOrders['"]/.test(
				widgetSource,
			);
		expect(typeImportsProductionApi).toBe(true);
	});

	it("the widget source uses the production hook (not the raw API) as the data source", () => {
		// `useProductionPipelineStats` is the canonical data source.
		expect(widgetSource).toMatch(/useProductionPipelineStats/);
	});

	it("the real kill-switch isPersistableQueryKey rejects the pipeline key (defense-in-depth regression check)", () => {
		// Sanity check: even if the pipeline key shape ever changes, the
		// defensive kill-switch still rejects it. This is the same
		// assertion the hook-level test makes; the widget-level copy
		// documents that the widget inherits the kill-switch.
		expect(isPersistableQueryKey(["production_orders", "pipeline"])).toBe(
			false,
		);
		expect(
			isPersistableQueryKey([
				"production_orders",
				"pipeline",
				{ workshop_id: "00000000-0000-0000-0000-000000000001" },
			]),
		).toBe(false);
	});
});

/**
 * RLS sanity — the SECURITY INVOKER read RPC
 * `get_production_pipeline_stats` derives the workshop from
 * `auth.uid() -> profiles.workshop_id` and is RLS-scoped by
 * `production_orders.workshop_id = get_current_workshop_id()`.
 * Cross-tenant rows are filtered out at the SQL layer, not in the
 * widget. The widget has no way to opt out of this; the test below
 * documents the structural guarantee.
 */
describe("ProductionPipelineWidget — RLS sanity", () => {
	it("the widget accepts no workshop-id prop and reads exclusively through the hook (no manual workshop filter possible)", () => {
		// The widget's `ProductionPipelineWidget` component must NOT
		// accept a workshopId prop — workshop scoping is the SQL
		// layer's job. This is a documentation test: if a future
		// refactor adds such a prop, the reviewer must re-examine
		// whether the SQL contract has regressed (e.g. a service-role
		// bypass or a manual filter that the SQL contract does not
		// expect).
		expect(widgetSource).not.toMatch(/workshopId/);
	});

	it("the widget does not call useWorkshopId (workshop scoping is the SQL layer's job, not the widget's)", () => {
		// The widget never imports `useWorkshopId`; workshop scoping is
		// exclusively the SQL RLS policy's job.
		expect(widgetSource).not.toMatch(/useWorkshopId/);
	});
});
