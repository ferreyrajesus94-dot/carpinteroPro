import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	render,
	screen,
	fireEvent,
	waitFor,
	within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StockMovementDetailPage } from "./StockMovementDetailPage";
import type { StockMovementDetail } from "../api/stockMovements";

vi.mock("../hooks/useStockMovements", () => ({
	useStockMovementDetail: vi.fn(),
	useReverseProductionDeduction: vi.fn(),
	useReverseStockMovement: vi.fn(),
}));

import {
	useReverseProductionDeduction,
	useReverseStockMovement,
	useStockMovementDetail,
} from "../hooks/useStockMovements";

const WORKSHOP_ID = "00000000-0000-0000-0000-000000000001";

const DETAIL: StockMovementDetail = {
	id: "mov-1",
	workshop_id: WORKSHOP_ID,
	material_id: "mat-1",
	material_name: "Madera MDF 18mm",
	material_unit: "un",
	delta: 10,
	reason: "compra",
	note: "Compra original",
	quote_id: null,
	quote_number: null,
	created_at: "2026-06-25T10:00:00Z",
	created_by: "user-1",
	creator_name: "Juan Pérez",
	reversal_of_movement_id: null,
	reversal_reason: null,
	reversed_original_reason: null,
	reversal_request_id: null,
	is_reversal: false,
	reversed_by_movement_id: null,
	production_deduction_id: null,
	is_production_deduction: false,
	production_deduction_status: null,
	// PR 7: production-order deep-link target (NULL for non-production movements).
	production_order_id: null,
	can_reverse: true,
};

function renderDetail(path = "/inventory/movements/mov-1") {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route
					path="/inventory/movements/:movementId"
					element={<StockMovementDetailPage />}
				/>
			</Routes>
		</MemoryRouter>,
	);
}

describe("StockMovementDetailPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useReverseStockMovement).mockReturnValue({
			mutateAsync: vi.fn().mockResolvedValue("rev-1"),
			isPending: false,
		} as unknown as ReturnType<typeof useReverseStockMovement>);
		vi.mocked(useReverseProductionDeduction).mockReturnValue({
			mutateAsync: vi.fn().mockResolvedValue({ id: "rev-batch" }),
			isPending: false,
		} as unknown as ReturnType<typeof useReverseProductionDeduction>);
	});

	it("shows loading state", () => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
		} as ReturnType<typeof useStockMovementDetail>);

		renderDetail();

		expect(screen.getByText("Cargando movimiento…")).toBeInTheDocument();
	});

	it("shows error state", () => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error("Forbidden"),
		} as ReturnType<typeof useStockMovementDetail>);

		renderDetail();

		expect(screen.getByRole("alert")).toHaveTextContent("Forbidden");
	});

	it("shows movement details and audit copy", () => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: DETAIL,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementDetail>);

		renderDetail();

		expect(screen.getByText("Detalle de movimiento")).toBeInTheDocument();
		expect(screen.getByText("Madera MDF 18mm")).toBeInTheDocument();
		expect(screen.getByText("Compra original")).toBeInTheDocument();
		expect(
			screen.getByText(/El movimiento original no se modifica/),
		).toBeInTheDocument();
	});

	it("shows human reversal reason instead of technical movement id for reversal rows", () => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: {
				...DETAIL,
				id: "rev-1",
				delta: -12,
				reason: "reversion",
				note: "Reversión de movimiento 93000000-0000-0000-0000-000000000005",
				reversal_of_movement_id: "93000000-0000-0000-0000-000000000005",
				reversal_reason: "QA visual: reversión desde UI",
				reversed_original_reason: "ajuste",
				is_reversal: true,
				can_reverse: false,
			},
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementDetail>);

		renderDetail();

		expect(screen.getByText("Motivo de reversión")).toBeInTheDocument();
		expect(
			screen.getByText("QA visual: reversión desde UI"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Este movimiento revierte un movimiento original."),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/93000000-0000-0000-0000-000000000005/),
		).not.toBeInTheDocument();
	});

	it("requires a non-empty reversal reason", async () => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: DETAIL,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementDetail>);
		const mutateAsync = vi.fn().mockResolvedValue("rev-1");
		vi.mocked(useReverseStockMovement).mockReturnValue({
			mutateAsync,
			isPending: false,
		} as unknown as ReturnType<typeof useReverseStockMovement>);

		renderDetail();

		fireEvent.click(
			screen.getByRole("button", { name: "Revertir movimiento" }),
		);

		await waitFor(() => {
			expect(screen.getByText("Ingresá un motivo para revertir."));
		});
		expect(mutateAsync).not.toHaveBeenCalled();
	});

	it("submits reversal with movement id, material id, and reason", async () => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: DETAIL,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementDetail>);
		const mutateAsync = vi.fn().mockResolvedValue("rev-1");
		vi.mocked(useReverseStockMovement).mockReturnValue({
			mutateAsync,
			isPending: false,
		} as unknown as ReturnType<typeof useReverseStockMovement>);

		renderDetail();

		fireEvent.change(screen.getByLabelText("Motivo de reversión"), {
			target: { value: "Carga duplicada" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Revertir movimiento" }),
		);

		await waitFor(() => {
			expect(mutateAsync).toHaveBeenCalledWith({
				movementId: "mov-1",
				materialId: "mat-1",
				reason: "Carga duplicada",
			});
		});
	});

	it("hides reversal action when movement cannot be reversed", () => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: { ...DETAIL, can_reverse: false, reversed_by_movement_id: "rev-1" },
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementDetail>);

		renderDetail();

		expect(
			screen.queryByRole("button", { name: "Revertir movimiento" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByText(/Este movimiento no está disponible para reversión/),
		).toBeInTheDocument();
	});

	describe("production-origin rows", () => {
		const PRODUCTION_DETAIL: StockMovementDetail = {
			...DETAIL,
			reason: "consumo_produccion",
			note: "Inicio de producción",
			quote_id: "q-3",
			quote_number: "P-2026-003",
			production_deduction_id: "pd-1",
			is_production_deduction: true,
			production_deduction_status: "completed",
		};

		it("shows production batch context section", () => {
			vi.mocked(useStockMovementDetail).mockReturnValue({
				data: PRODUCTION_DETAIL,
				isLoading: false,
				error: null,
			} as ReturnType<typeof useStockMovementDetail>);

			renderDetail();

			expect(screen.getByText("Descuento de producción")).toBeInTheDocument();
			expect(
				screen.getByText(/Revertí el lote completo para corregir/i),
			).toBeInTheDocument();
		});

		it("shows batch reversal CTA for production rows", () => {
			vi.mocked(useStockMovementDetail).mockReturnValue({
				data: PRODUCTION_DETAIL,
				isLoading: false,
				error: null,
			} as ReturnType<typeof useStockMovementDetail>);

			renderDetail();

			expect(
				screen.getByRole("button", { name: /revertir lote completo/i }),
			).toBeInTheDocument();
		});

		it("shows reversed state when production batch is reversed", () => {
			vi.mocked(useStockMovementDetail).mockReturnValue({
				data: {
					...PRODUCTION_DETAIL,
					production_deduction_status: "reversed",
				},
				isLoading: false,
				error: null,
			} as ReturnType<typeof useStockMovementDetail>);

			renderDetail();

			expect(screen.getByText(/El lote ya fue revertido/i)).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: /revertir lote completo/i }),
			).not.toBeInTheDocument();
		});

	it("calls batch reversal on confirm with reason", async () => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: PRODUCTION_DETAIL,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementDetail>);
		const mutateAsync = vi.fn().mockResolvedValue({ id: "rev-batch" });
		vi.mocked(useReverseProductionDeduction).mockReturnValue({
			mutateAsync,
			isPending: false,
		} as unknown as ReturnType<typeof useReverseProductionDeduction>);

		renderDetail();

		fireEvent.change(screen.getByLabelText("Motivo de reversión del lote"), {
			target: { value: "Error en la producción" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: /revertir lote completo/i }),
		);

		await waitFor(() => {
			expect(mutateAsync).toHaveBeenCalledWith({
				deductionId: "pd-1",
				reversalReason: "Error en la producción",
			});
		});
	});
});

describe("StockMovementDetailPage — production-order deep link (PR 7)", () => {
	const PRODUCTION_DETAIL_WITH_ORDER: StockMovementDetail = {
		...DETAIL,
		reason: "consumo_produccion",
		note: "Inicio de producción",
		quote_id: "q-3",
		quote_number: "P-2026-003",
		production_deduction_id: "pd-1",
		is_production_deduction: true,
		production_deduction_status: "completed",
		production_order_id: "order-abc-123",
	};

	const PRODUCTION_DETAIL_WITHOUT_ORDER: StockMovementDetail = {
		...PRODUCTION_DETAIL_WITH_ORDER,
		production_order_id: null,
	};

	const NON_PRODUCTION_DETAIL: StockMovementDetail = {
		...DETAIL,
		reason: "compra",
		production_order_id: null,
	};

	beforeEach(() => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: PRODUCTION_DETAIL_WITH_ORDER,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementDetail>);
	});

	it("renders a 'Ver orden de producción' link when the movement is production-origin AND the deduction has a production_order_id", () => {
		renderDetail();

		const link = screen.getByRole("link", {
			name: /ver orden de producci[oó]n/i,
		});
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute("href", "/production/order-abc-123");
	});

	it("hides the deep link when the movement is production-origin BUT the deduction has a null production_order_id (legacy batch)", () => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: PRODUCTION_DETAIL_WITHOUT_ORDER,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementDetail>);

		renderDetail();

		expect(
			screen.queryByRole("link", { name: /ver orden de producci[oó]n/i }),
		).not.toBeInTheDocument();
	});

	it("hides the deep link for non-production movements (compra, reversion, ajuste)", () => {
		vi.mocked(useStockMovementDetail).mockReturnValue({
			data: NON_PRODUCTION_DETAIL,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStockMovementDetail>);

		renderDetail();

		expect(
			screen.queryByRole("link", { name: /ver orden de producci[oó]n/i }),
		).not.toBeInTheDocument();
	});

	it("renders the link inside the production-batch context section so the user sees it together with the other production-deduction context", () => {
		renderDetail();

		// The production-batch context heading and the deep link are
		// both rendered. Asserting the link text inside the production
		// section ensures the link is not orphaned in a separate panel.
		const batchSection = screen
			.getByText("Descuento de producción")
			.closest("section");
		expect(batchSection).not.toBeNull();
		expect(
			within(batchSection as HTMLElement).getByRole("link", {
				name: /ver orden de producci[oó]n/i,
			}),
		).toBeInTheDocument();
	});
});
});
