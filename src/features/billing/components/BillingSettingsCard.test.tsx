import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BillingSettingsCard, FIRST_PERIOD_BUFFER_DAYS } from "./BillingSettingsCard";
import type { SubscriptionRow } from "@/features/billing/types";

const createMutateAsync = vi.fn();
const cancelMutateAsync = vi.fn();
let createIsPending = false;
let createError: Error | null = null;
let cancelError: Error | null = null;

vi.mock("@/features/billing/hooks/useBillingActions", () => ({
	useCreateSubscription: () => ({
		mutateAsync: createMutateAsync,
		isPending: createIsPending,
		error: createError,
	}),
	useCancelSubscription: () => ({
		mutateAsync: cancelMutateAsync,
		isPending: false,
		error: cancelError,
	}),
}));

function makeSub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
	return {
		id: "sub-1",
		workshop_id: "ws-1",
		status: "trialing",
		plan: "pro_monthly",
		provider: "mercadopago",
		trial_starts_at: "2026-01-01T00:00:00Z",
		trial_ends_at: "2026-01-15T00:00:00Z",
		current_period_starts_at: null,
		current_period_ends_at: null,
		provider_subscription_id: null,
		provider_preapproval_id: null,
		provider_status: null,
		provider_snapshot_at: null,
		provider_snapshot_resource_kind: null,
		provider_snapshot_resource_id: null,
		provider_fetched_at: null,
		first_period_discount_pct: null,
		referred_by_referral_code_id: null,
		cancel_at_period_end: false,
		cancelled_at: null,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

beforeEach(() => {
	createMutateAsync.mockReset();
	cancelMutateAsync.mockReset();
	createIsPending = false;
	createError = null;
	cancelError = null;
	vi.stubGlobal(
		"confirm",
		vi.fn(() => true),
	);
	Object.defineProperty(window, "location", {
		value: { assign: vi.fn() },
		writable: true,
	});
});

describe("BillingSettingsCard", () => {
	it("documents the first-period discount buffer as a named constant", () => {
		expect(FIRST_PERIOD_BUFFER_DAYS).toBe(45);
	});

	it("shows trial, active, blocked, and scheduled-cancel states", () => {
		const { rerender } = render(
			<BillingSettingsCard subscription={makeSub()} />,
		);
		expect(screen.getByText("Período de prueba")).toBeInTheDocument();
		expect(screen.getByText(/Finaliza el 15\/1\/2026/)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Empezar suscripción/i }),
		).toBeInTheDocument();

		rerender(
			<BillingSettingsCard
				subscription={makeSub({
					status: "active",
					current_period_starts_at: "2026-02-01T00:00:00Z",
					current_period_ends_at: "2026-03-01T00:00:00Z",
				})}
			/>,
		);
		expect(screen.getByText("Suscripción activa")).toBeInTheDocument();
		expect(
			screen.getByText(/Período actual: 1\/2\/2026 al 1\/3\/2026/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Próximo cargo: ARS 4,990\/mes/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Cancelar/i }),
		).toBeInTheDocument();

		rerender(
			<BillingSettingsCard subscription={makeSub({ status: "past_due" })} />,
		);
		expect(screen.getByText("Pago requerido")).toBeInTheDocument();
		expect(screen.getByText(/Actualizá el medio de pago/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Actualizar pago/i }),
		).toBeInTheDocument();

		rerender(
			<BillingSettingsCard
				subscription={makeSub({
					status: "active",
					current_period_ends_at: "2026-03-01T00:00:00Z",
					cancel_at_period_end: true,
				})}
			/>,
		);
		expect(screen.getByText("Cancelación programada")).toBeInTheDocument();
		expect(
			screen.getByText(/Acceso disponible hasta el 1\/3\/2026/),
		).toBeInTheDocument();
	});

	it("starts checkout, cancels with confirmation, handles pending state, and shows errors", async () => {
		createMutateAsync.mockResolvedValue({
			initPoint: "https://mp.test/checkout",
		});
		const { rerender } = render(
			<BillingSettingsCard subscription={makeSub()} />,
		);
		fireEvent.click(
			screen.getByRole("button", { name: /Empezar suscripción/i }),
		);
		await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
		expect(window.location.assign).toHaveBeenCalledWith(
			"https://mp.test/checkout",
		);

		cancelMutateAsync.mockResolvedValue({ status: "active" });
		rerender(
			<BillingSettingsCard subscription={makeSub({ status: "active" })} />,
		);
		fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
		await waitFor(() => expect(cancelMutateAsync).toHaveBeenCalledTimes(1));
		expect(window.confirm).toHaveBeenCalledWith(
			expect.stringContaining("¿Querés cancelar"),
		);

		createIsPending = true;
		rerender(<BillingSettingsCard subscription={makeSub()} />);
		expect(
			screen.getByRole("button", { name: /Abriendo pago/i }),
		).toBeDisabled();

		createIsPending = false;
		createMutateAsync.mockRejectedValue(new Error("MercadoPago no disponible"));
		rerender(<BillingSettingsCard subscription={makeSub()} />);
		fireEvent.click(
			screen.getByRole("button", { name: /Empezar suscripción/i }),
		);
		expect(
			await screen.findByText("MercadoPago no disponible"),
		).toBeInTheDocument();
	});

	it("shows discount message during first period (trialing)", () => {
		const sub = makeSub({
			first_period_discount_pct: 20,
			status: "trialing",
			created_at: "2026-01-01T00:00:00Z",
			trial_starts_at: "2026-01-01T00:00:00Z",
			trial_ends_at: "2026-01-15T00:00:00Z",
		});
		render(<BillingSettingsCard subscription={sub} />);

		// Discount message should appear
		expect(
			screen.getByText(/Descuento aplicado.*?20%.*?primer período/i),
		).toBeInTheDocument();
	});

	it("shows discount message during first period (active)", () => {
		const sub = makeSub({
			first_period_discount_pct: 20,
			status: "active",
			created_at: "2026-01-01T00:00:00Z",
			current_period_starts_at: "2026-01-01T00:00:00Z",
			current_period_ends_at: "2026-02-01T00:00:00Z",
		});
		render(<BillingSettingsCard subscription={sub} />);

		expect(
			screen.getByText(/Descuento aplicado.*?20%.*?primer período/i),
		).toBeInTheDocument();
	});

	it("hides discount message when first period has ended", () => {
		// current_period_starts_at is 60 days after created_at = second period
		const sub = makeSub({
			first_period_discount_pct: 20,
			status: "active",
			created_at: "2026-01-01T00:00:00Z",
			current_period_starts_at: "2026-03-02T00:00:00Z",
			current_period_ends_at: "2026-04-01T00:00:00Z",
		});
		render(<BillingSettingsCard subscription={sub} />);

		expect(
			screen.queryByText(/Descuento aplicado.*?primer período/i),
		).not.toBeInTheDocument();
	});

	it("does not show discount message when first_period_discount_pct is null", () => {
		const sub = makeSub({
			first_period_discount_pct: null,
			status: "active",
			created_at: "2026-01-01T00:00:00Z",
			current_period_starts_at: "2026-01-01T00:00:00Z",
			current_period_ends_at: "2026-02-01T00:00:00Z",
		});
		render(<BillingSettingsCard subscription={sub} />);

		expect(
			screen.queryByText(/Descuento aplicado/i),
		).not.toBeInTheDocument();
	});
});
