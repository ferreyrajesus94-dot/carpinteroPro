import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("../hooks/useProductionOrders", () => ({
	useStartProductionOrder: vi.fn(),
}));

import { useStartProductionOrder } from "../hooks/useProductionOrders";
import { StartProductionDialog } from "./StartProductionDialog";

const mockUseStartProductionOrder = vi.mocked(useStartProductionOrder);

const QUOTE_ID = "22222222-2222-4222-8222-222222222222";

const approvedQuote = {
	id: QUOTE_ID,
	workshop_id: "00000000-0000-0000-0000-000000000001",
	quote_number: "Q-2026-0001",
	furniture_name: "Mesa de roble",
	client_id: null,
	client_name: "Acme SRL",
	stored_status: "aprobado" as const,
	production_status: "aprobado" as const,
	has_active_production: false,
	last_event_at: null,
};

function makeQueryWrapper() {
	const client = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockUseStartProductionOrder.mockReturnValue({
		mutateAsync: vi.fn().mockResolvedValue({ id: "new-order" }),
		isPending: false,
		reset: vi.fn(),
	} as unknown as ReturnType<typeof useStartProductionOrder>);
});

describe("StartProductionDialog — rendering", () => {
	it("renders the quote number and furniture name in the title", () => {
		render(
			<StartProductionDialog
				quote={approvedQuote}
				open={true}
				onOpenChange={vi.fn()}
			/>,
			{ wrapper: makeQueryWrapper() },
		);

		expect(
			screen.getByRole("heading", { name: /Q-2026-0001.*Mesa de roble/ }),
		).toBeInTheDocument();
	});

	it("renders form fields: production number, planned start, planned end, notes", () => {
		render(
			<StartProductionDialog
				quote={approvedQuote}
				open={true}
				onOpenChange={vi.fn()}
			/>,
			{ wrapper: makeQueryWrapper() },
		);

		expect(screen.getByLabelText(/número de orden/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/inicio planificado/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/fin planificado/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/notas/i)).toBeInTheDocument();
	});
});

describe("StartProductionDialog — submission", () => {
	it("calls startProductionOrder with the form values on confirm", async () => {
		const mutateAsync = vi.fn().mockResolvedValue({ id: "new-order" });
		mockUseStartProductionOrder.mockReturnValue({
			mutateAsync,
			isPending: false,
			reset: vi.fn(),
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		const onOpenChange = vi.fn();
		render(
			<StartProductionDialog
				quote={approvedQuote}
				open={true}
				onOpenChange={onOpenChange}
			/>,
			{ wrapper: makeQueryWrapper() },
		);

		fireEvent.change(screen.getByLabelText(/número de orden/i), {
			target: { value: "OP-2026-0042" },
		});
		fireEvent.change(screen.getByLabelText(/inicio planificado/i), {
			target: { value: "2026-07-15" },
		});
		fireEvent.change(screen.getByLabelText(/fin planificado/i), {
			target: { value: "2026-07-25" },
		});
		fireEvent.change(screen.getByLabelText(/notas/i), {
			target: { value: "Cliente prioritario" },
		});

		fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

		await waitFor(() => {
			expect(mutateAsync).toHaveBeenCalledTimes(1);
		});
		expect(mutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				quoteId: QUOTE_ID,
				productionNumber: "OP-2026-0042",
				plannedStartDate: "2026-07-15",
				plannedEndDate: "2026-07-25",
				notes: "Cliente prioritario",
			}),
		);

		// After successful start, the dialog requests close.
		await waitFor(() => {
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});
	});

	it("sends null for empty optional fields", async () => {
		const mutateAsync = vi.fn().mockResolvedValue({ id: "new-order" });
		mockUseStartProductionOrder.mockReturnValue({
			mutateAsync,
			isPending: false,
			reset: vi.fn(),
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		render(
			<StartProductionDialog
				quote={approvedQuote}
				open={true}
				onOpenChange={vi.fn()}
			/>,
			{ wrapper: makeQueryWrapper() },
		);

		fireEvent.change(screen.getByLabelText(/número de orden/i), {
			target: { value: "OP-2026-0001" },
		});
		fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

		await waitFor(() => {
			expect(mutateAsync).toHaveBeenCalledTimes(1);
		});
		expect(mutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				quoteId: QUOTE_ID,
				productionNumber: "OP-2026-0001",
				plannedStartDate: null,
				plannedEndDate: null,
				notes: null,
			}),
		);
	});

	it("does NOT close the dialog when startProductionOrder rejects (error is toasted by the mutation, not swallowed)", async () => {
		const mutateAsync = vi.fn().mockRejectedValue(new Error("RPC failed"));
		mockUseStartProductionOrder.mockReturnValue({
			mutateAsync,
			isPending: false,
			reset: vi.fn(),
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		const onOpenChange = vi.fn();
		render(
			<StartProductionDialog
				quote={approvedQuote}
				open={true}
				onOpenChange={onOpenChange}
			/>,
			{ wrapper: makeQueryWrapper() },
		);

		fireEvent.change(screen.getByLabelText(/número de orden/i), {
			target: { value: "OP-2026-0001" },
		});
		fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

		await waitFor(() => {
			expect(mutateAsync).toHaveBeenCalledTimes(1);
		});
		// The dialog stays open so the user can fix the input and retry.
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});
});

describe("StartProductionDialog — cancel", () => {
	it("calls onOpenChange(false) when cancel is clicked and does not call startProductionOrder", () => {
		const mutateAsync = vi.fn();
		mockUseStartProductionOrder.mockReturnValue({
			mutateAsync,
			isPending: false,
			reset: vi.fn(),
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		const onOpenChange = vi.fn();
		render(
			<StartProductionDialog
				quote={approvedQuote}
				open={true}
				onOpenChange={onOpenChange}
			/>,
			{ wrapper: makeQueryWrapper() },
		);

		fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(mutateAsync).not.toHaveBeenCalled();
	});
});
