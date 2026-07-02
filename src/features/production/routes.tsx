import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { ProductionBoard } from "./components/ProductionBoard";
import { ProductionOrderDetailPage } from "./components/ProductionOrderDetailPage";
import { StartProductionDialog } from "./components/StartProductionDialog";
import type { QuoteWithProductionStatus } from "./api/productionOrders";

/**
 * Production feature routes — mounted at `/production/*` from
 * `src/app/router.tsx`.
 *
 * - `/production` (index) renders the Kanban-style board with an
 *   embedded start-production dialog.
 * - `/production/:id` renders the read-only production-order detail
 *   page.
 *
 * The dialog state (which quote, if any, is being started) is owned by
 * the `ProductionBoardPage` shell rather than by a separate route so
 * that the user always returns to the board after the dialog closes.
 */
function ProductionBoardPage() {
	const [startTarget, setStartTarget] = useState<QuoteWithProductionStatus | null>(
		null,
	);

  return (
    <>
      <ProductionBoard onStartProduction={setStartTarget} />
      {startTarget && (
        <StartProductionDialog
          key={startTarget.id}
          quote={startTarget}
          open={true}
          onOpenChange={(open) => {
            if (!open) setStartTarget(null);
          }}
        />
      )}
		</>
	);
}

export function ProductionRoutes() {
	return (
		<Routes>
			<Route index element={<ProductionBoardPage />} />
			<Route path=":id" element={<ProductionOrderDetailPage />} />
		</Routes>
	);
}
