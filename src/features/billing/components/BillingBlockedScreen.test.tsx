import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BillingBlockedScreen } from "./BillingBlockedScreen";
import type { SubscriptionRow } from "@/features/billing/types";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({
		signOut: vi.fn(),
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
		cancel_at_period_end: false,
		cancelled_at: null,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

describe("BillingBlockedScreen", () => {
	it("renders blocked message without business data", () => {
		render(
			<BillingBlockedScreen subscription={makeSub({ status: "past_due" })} />,
		);

		expect(screen.getByText("Pago pendiente")).toBeInTheDocument();
		expect(
			screen.getByText(/Tu acceso a la app está suspendido/i),
		).toBeInTheDocument();
		expect(screen.queryByText(/Dashboard/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Presupuestos/i)).not.toBeInTheDocument();
	});

	it("shows 'Empezar suscripción' when trialing", () => {
		render(
			<BillingBlockedScreen subscription={makeSub({ status: "trialing" })} />,
		);
		expect(
			screen.getByRole("button", { name: /Empezar suscripción/i }),
		).toBeInTheDocument();
	});

	it("shows 'Actualizar pago' when past_due", () => {
		render(
			<BillingBlockedScreen subscription={makeSub({ status: "past_due" })} />,
		);
		expect(
			screen.getByRole("button", { name: /Actualizar pago/i }),
		).toBeInTheDocument();
	});

	it("shows 'Actualizar pago' when unpaid", () => {
		render(
			<BillingBlockedScreen subscription={makeSub({ status: "unpaid" })} />,
		);
		expect(
			screen.getByRole("button", { name: /Actualizar pago/i }),
		).toBeInTheDocument();
	});

	it("shows 'Suscribirse' when cancelled", () => {
		render(
			<BillingBlockedScreen subscription={makeSub({ status: "cancelled" })} />,
		);
		expect(
			screen.getByRole("button", { name: /Suscribirse/i }),
		).toBeInTheDocument();
	});

	it("calls onStartPayment when primary action clicked", () => {
		const onStart = vi.fn();
		render(
			<BillingBlockedScreen
				subscription={makeSub({ status: "unpaid" })}
				onStartPayment={onStart}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Actualizar pago/i }));
		expect(onStart).toHaveBeenCalledTimes(1);
	});

	it("disables primary action while payment is starting", () => {
		render(
			<BillingBlockedScreen
				subscription={makeSub({ status: "unpaid" })}
				isPaymentLoading={true}
			/>,
		);

		expect(
			screen.getByRole("button", { name: /Abriendo pago/i }),
		).toBeDisabled();
	});

	it("renders support links", () => {
		render(<BillingBlockedScreen subscription={makeSub()} />);
		expect(screen.getByRole("link", { name: /WhatsApp/i })).toHaveAttribute(
			"href",
			expect.stringContaining("wa.me"),
		);
		expect(screen.getByRole("link", { name: /email/i })).toHaveAttribute(
			"href",
			expect.stringContaining("mailto:hola@carpinteropro.app"),
		);
	});

	it("renders logout button", () => {
		render(<BillingBlockedScreen subscription={makeSub()} />);
		expect(
			screen.getByRole("button", { name: /Cerrar sesión/i }),
		).toBeInTheDocument();
	});

	it("renders fallback text when subscription is null", () => {
		render(<BillingBlockedScreen subscription={null} />);
		expect(screen.getByText(/Acceso suspendido/i)).toBeInTheDocument();
	});
});
