import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// The QuoteActions component delegates "Iniciar producción" to the
// production feature's `useStartProductionOrder` hook. That hook lives
// behind the production feature's `featureZone("production")` ESLint
// boundary; from a strict unit-test perspective we mock the hook so the
// test stays focused on the component contract (which hook it uses,
// what payload it sends, and how it surfaces success/error). The
// integration between the hook and the SQL layer is covered by the PR 5
// hook tests + the PR 2/3 SQL suite.
vi.mock("@/features/production", () => ({
	useStartProductionOrder: vi.fn(),
}));

vi.mock("../hooks/useQuotes", () => ({
	useUpdateQuote: vi.fn(),
	useUpdateQuoteStatus: vi.fn(),
}));

import { useStartProductionOrder } from "@/features/production";
import { useUpdateQuote, useUpdateQuoteStatus } from "../hooks/useQuotes";
import { QuoteActions } from "./QuoteActions";

const mockUseStartProductionOrder = vi.mocked(useStartProductionOrder);
const mockUseUpdateQuote = vi.mocked(useUpdateQuote);
const mockUseUpdateQuoteStatus = vi.mocked(useUpdateQuoteStatus);

const QUOTE_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCTION_NUMBER = "OP-2026-0099";

function makeQueryWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return ({ children }: { children: React.ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
	vi.clearAllMocks();

	// The legacy hooks must NEVER be invoked by QuoteActions. The test
	// still wires them up with sentinel fns so a regression that reaches
	// for them fails loudly.
	mockUseUpdateQuote.mockReturnValue({
		mutate: vi.fn(),
		mutateAsync: vi.fn(),
	} as unknown as ReturnType<typeof useUpdateQuote>);
	mockUseUpdateQuoteStatus.mockReturnValue({
		mutate: vi.fn(),
		mutateAsync: vi.fn(),
	} as unknown as ReturnType<typeof useUpdateQuoteStatus>);
});

describe("QuoteActions — start-production entry point", () => {
	it("calls useStartProductionOrder from the production barrel with the production number when the user confirms", async () => {
		const mutateAsync = vi.fn().mockResolvedValue({ id: "order-1" });
		mockUseStartProductionOrder.mockReturnValue({
			mutate: vi.fn(),
			mutateAsync,
			isPending: false,
			isError: false,
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		const onSuccess = vi.fn();
		render(
			<QuoteActions
				quoteId={QUOTE_ID}
				productionNumber={PRODUCTION_NUMBER}
				onSuccess={onSuccess}
			/>,
			{ wrapper: makeQueryWrapper() },
		);

		fireEvent.click(screen.getByRole("button", { name: /iniciar producci[oó]n/i }));

		await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
		expect(mutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				quoteId: QUOTE_ID,
				productionNumber: PRODUCTION_NUMBER,
			}),
		);

		await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
	});

	it("does NOT call useUpdateQuote or useUpdateQuoteStatus (the four-layer en_produccion guard stays in place)", () => {
		const mutateAsync = vi.fn().mockResolvedValue({ id: "order-1" });
		mockUseStartProductionOrder.mockReturnValue({
			mutate: vi.fn(),
			mutateAsync,
			isPending: false,
			isError: false,
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		render(
			<QuoteActions
				quoteId={QUOTE_ID}
				productionNumber={PRODUCTION_NUMBER}
			/>,
			{ wrapper: makeQueryWrapper() },
		);

		// The legacy hooks should never have been touched by the
		// component, even though QuoteActions received the production
		// number and is ready to fire.
		expect(mockUseUpdateQuote).not.toHaveBeenCalled();
		expect(mockUseUpdateQuoteStatus).not.toHaveBeenCalled();
	});

	// TRIANGULATE: when the hook rejects (e.g. RPC failure), the
	// component surfaces the error in a `role="alert"` element so the
	// user knows the action did not succeed. The action must NOT
	// invoke onSuccess in this branch.
	it("renders an inline error when the hook rejects and does not call onSuccess", async () => {
		const mutateAsync = vi
			.fn()
			.mockRejectedValue(new Error("RPC failed: en_produccion guard"));
		mockUseStartProductionOrder.mockReturnValue({
			mutate: vi.fn(),
			mutateAsync,
			isPending: false,
			isError: false,
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		const onSuccess = vi.fn();
		render(
			<QuoteActions
				quoteId={QUOTE_ID}
				productionNumber={PRODUCTION_NUMBER}
				onSuccess={onSuccess}
			/>,
			{ wrapper: makeQueryWrapper() },
		);

		fireEvent.click(screen.getByRole("button", { name: /iniciar producci[oó]n/i }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent(/producci[oó]n|RPC|error/i);

		// Give the rejected promise a tick to settle; onSuccess must NOT
		// fire on a failed start.
		await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
		expect(onSuccess).not.toHaveBeenCalled();
	});

	// TRIANGULATE: while the mutation is pending, the button is disabled
	// to prevent double-submits. The disabled state is observed via the
	// DOM `disabled` attribute (behavioral, not coupled to a CSS class).
	it("disables the start button while the mutation is pending", () => {
		const mutateAsync = vi.fn().mockResolvedValue({ id: "order-1" });
		mockUseStartProductionOrder.mockReturnValue({
			mutate: vi.fn(),
			mutateAsync,
			isPending: true,
			isError: false,
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		render(
			<QuoteActions
				quoteId={QUOTE_ID}
				productionNumber={PRODUCTION_NUMBER}
			/>,
			{ wrapper: makeQueryWrapper() },
		);

		// The button text changes to "Iniciando..." while the mutation is
		// pending, so we find it via the testid (the structural hook)
		// rather than the label. The disabled attribute is the
		// behavioral contract under test.
		const button = screen.getByTestId("quote-actions-start");
		expect(button).toBeDisabled();
	});
});

describe("QuoteActions — production-number input", () => {
	// TRIANGULATE: the production number can be supplied at construction
	// time (the dashboard's quote-projection row carries the assigned
	// number, for example), OR the component can render an input the
	// user types into. When `productionNumber` prop is provided, the
	// input is hidden and the prop is sent verbatim. When omitted, the
	// input renders, the button is disabled until the user types a
	// non-empty value, and the typed value is sent on click.
	it("renders an input and sends the typed value when no productionNumber prop is provided", async () => {
		const mutateAsync = vi.fn().mockResolvedValue({ id: "order-1" });
		mockUseStartProductionOrder.mockReturnValue({
			mutate: vi.fn(),
			mutateAsync,
			isPending: false,
			isError: false,
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		render(<QuoteActions quoteId={QUOTE_ID} />, {
			wrapper: makeQueryWrapper(),
		});

		const input = screen.getByLabelText(/n[uú]mero de orden/i);
		expect(input).toBeInTheDocument();

		// Button is disabled while the input is empty.
		const button = screen.getByRole("button", { name: /iniciar producci[oó]n/i });
		expect(button).toBeDisabled();

		fireEvent.change(input, { target: { value: "OP-2026-0007" } });
		expect(button).not.toBeDisabled();

		fireEvent.click(button);
		await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
		expect(mutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				quoteId: QUOTE_ID,
				productionNumber: "OP-2026-0007",
			}),
		);
	});
});

/**
 * PR 8 review-blocker fix #5: the QuoteActions input MUST have a
 * stable per-instance `id` so multiple QuoteActions on the same
 * page (e.g. a future quote table) don't collide on the
 * same `id` attribute (which is invalid HTML and breaks the
 * `htmlFor` / aria-labelledby association for screen readers).
 *
 * The original implementation hard-coded
 * `id="quote-actions-production-number"` — a regression that
 * rendered two QuoteActions on the same page would have two
 * inputs with the same id, which is invalid HTML and breaks
 * the implicit `<label htmlFor>` association.
 *
 * The fix is `useId()` from React 19. This test pins the
 * per-instance id contract: two QuoteActions on the same page
 * have different input ids.
 */
describe("QuoteActions — per-instance input id (PR 8 review-blocker fix #5)", () => {
	it("two QuoteActions on the same page render with DIFFERENT input ids (no duplicate-id HTML regression)", () => {
		const mutateAsync = vi.fn().mockResolvedValue({ id: "order-1" });
		mockUseStartProductionOrder.mockReturnValue({
			mutate: vi.fn(),
			mutateAsync,
			isPending: false,
			isError: false,
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		const { container } = render(
			<>
				<QuoteActions quoteId={QUOTE_ID} />
				<QuoteActions quoteId={QUOTE_ID} />
			</>,
			{ wrapper: makeQueryWrapper() },
		);

		// Find every <input> the component rendered. With
		// per-instance ids, there must be exactly 2 inputs (one
		// per QuoteActions), each with a unique id.
		const inputs = Array.from(
			container.querySelectorAll('input[name="productionNumber"]'),
		);
		expect(inputs).toHaveLength(2);

		const ids = inputs.map((el) => el.getAttribute("id"));
		expect(new Set(ids).size).toBe(2);
		// The per-instance ids must be non-empty (a regression
		// that drops the `id` attribute would break the implicit
		// <label htmlFor> association).
		for (const id of ids) {
			expect(id).toBeTruthy();
		}
	});

	it("each QuoteActions input's label `htmlFor` matches the input's id (a11y association per instance)", () => {
		const mutateAsync = vi.fn().mockResolvedValue({ id: "order-1" });
		mockUseStartProductionOrder.mockReturnValue({
			mutate: vi.fn(),
			mutateAsync,
			isPending: false,
			isError: false,
		} as unknown as ReturnType<typeof useStartProductionOrder>);

		const { container } = render(
			<>
				<QuoteActions quoteId={QUOTE_ID} />
				<QuoteActions quoteId={QUOTE_ID} />
			</>,
			{ wrapper: makeQueryWrapper() },
		);

		// For every rendered input, the sibling <label>'s `for`
		// attribute MUST equal the input's id. This is the
		// implicit-association contract that breaks with
		// duplicate ids (the second label would point to the
		// first input, confusing screen readers).
		const inputs = Array.from(
			container.querySelectorAll('input[name="productionNumber"]'),
		);
		expect(inputs).toHaveLength(2);
		for (const input of inputs) {
			const id = input.getAttribute("id");
			expect(id).toBeTruthy();
			const label = container.querySelector(`label[for="${id}"]`);
			expect(label).not.toBeNull();
		}
	});
});
