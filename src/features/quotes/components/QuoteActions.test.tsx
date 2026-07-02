import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuoteActions } from "./QuoteActions";

const QUOTE_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCTION_NUMBER = "OP-2026-0099";

function createDeferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

describe("QuoteActions", () => {
	it("calls the injected start-production action with the production number and invokes onSuccess", async () => {
		const startProductionOrder = vi.fn().mockResolvedValue({ id: "order-1" });
		const onSuccess = vi.fn();

		render(
			<QuoteActions
				quoteId={QUOTE_ID}
				productionNumber={PRODUCTION_NUMBER}
				startProductionOrder={startProductionOrder}
				onSuccess={onSuccess}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /iniciar producci[oó]n/i }));

		await waitFor(() => expect(startProductionOrder).toHaveBeenCalledTimes(1));
		expect(startProductionOrder).toHaveBeenCalledWith({
			quoteId: QUOTE_ID,
			productionNumber: PRODUCTION_NUMBER,
		});

		await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
	});

	it("renders an inline error when the injected action rejects", async () => {
		const startProductionOrder = vi
			.fn()
			.mockRejectedValue(new Error("RPC failed: en_produccion guard"));
		const onSuccess = vi.fn();

		render(
			<QuoteActions
				quoteId={QUOTE_ID}
				productionNumber={PRODUCTION_NUMBER}
				startProductionOrder={startProductionOrder}
				onSuccess={onSuccess}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /iniciar producci[oó]n/i }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent(/producci[oó]n|RPC|error/i);
		await waitFor(() => expect(startProductionOrder).toHaveBeenCalledTimes(1));
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("disables the start button while the injected action is pending", async () => {
		const deferred = createDeferred<{ id: string }>();
		const startProductionOrder = vi.fn(() => deferred.promise);

		render(
			<QuoteActions
				quoteId={QUOTE_ID}
				productionNumber={PRODUCTION_NUMBER}
				startProductionOrder={startProductionOrder}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /iniciar producci[oó]n/i }));

		expect(screen.getByTestId("quote-actions-start")).toBeDisabled();
		deferred.resolve({ id: "order-1" });
		await waitFor(() => expect(startProductionOrder).toHaveBeenCalledTimes(1));
	});

	it("renders an input and sends the typed value when no productionNumber prop is provided", async () => {
		const startProductionOrder = vi.fn().mockResolvedValue({ id: "order-1" });

		render(
			<QuoteActions
				quoteId={QUOTE_ID}
				startProductionOrder={startProductionOrder}
			/>,
		);

		const input = screen.getByLabelText(/n[uú]mero de orden/i);
		expect(input).toBeInTheDocument();

		const button = screen.getByRole("button", { name: /iniciar producci[oó]n/i });
		expect(button).toBeDisabled();

		fireEvent.change(input, { target: { value: "OP-2026-0007" } });
		expect(button).not.toBeDisabled();

		fireEvent.click(button);
		await waitFor(() => expect(startProductionOrder).toHaveBeenCalledTimes(1));
		expect(startProductionOrder).toHaveBeenCalledWith({
			quoteId: QUOTE_ID,
			productionNumber: "OP-2026-0007",
		});
	});

	it("renders stable per-instance ids and matching labels", () => {
		const startProductionOrder = vi.fn().mockResolvedValue({ id: "order-1" });

		const { container } = render(
			<>
				<QuoteActions quoteId={QUOTE_ID} startProductionOrder={startProductionOrder} />
				<QuoteActions quoteId={QUOTE_ID} startProductionOrder={startProductionOrder} />
			</>,
		);

		const inputs = Array.from(
			container.querySelectorAll('input[name="productionNumber"]'),
		);
		expect(inputs).toHaveLength(2);

		const ids = inputs.map((el) => el.getAttribute("id"));
		expect(new Set(ids).size).toBe(2);
		for (const id of ids) {
			expect(id).toBeTruthy();
			expect(container.querySelector(`label[for="${id}"]`)).not.toBeNull();
		}
	});
});
