import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BillingBlockedScreen } from "./BillingBlockedScreen";
import type { SubscriptionRow } from "@/features/billing/types";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({
		signOut: vi.fn(),
	}),
}));

vi.mock("@/features/billing/hooks/useBillingActions", () => ({
	useCreateSubscription: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		error: null,
	}),
	useCancelSubscription: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		error: null,
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
		cancel_at_period_end: false,
		cancelled_at: null,
		first_period_discount_pct: null,
		referred_by_referral_code_id: null,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

describe("BillingBlockedScreen", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

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

	it("renders WhatsApp and support email links when support email is configured", () => {
		vi.stubEnv("VITE_SUPPORT_EMAIL", "soporte@carpinteropro.app");
		render(<BillingBlockedScreen subscription={makeSub()} />);

		const whatsappLink = screen.getByTestId("billing-whatsapp-link");
		expect(whatsappLink).toHaveAttribute(
			"href",
			expect.stringContaining("https://wa.me/"),
		);

		const supportLink = screen.getByTestId("billing-support-link");
		expect(supportLink).toHaveAttribute(
			"href",
			expect.stringContaining("mailto:soporte@carpinteropro.app"),
		);
		expect(supportLink).toHaveAttribute(
			"href",
			expect.stringContaining("subject=Ayuda%20con%20mi%20suscripci%C3%B3n"),
		);
	});

	it("keeps WhatsApp and does not render broken email link when support email is absent", () => {
		vi.stubEnv("VITE_SUPPORT_EMAIL", "");
		render(<BillingBlockedScreen subscription={makeSub()} />);

		expect(screen.getByTestId("billing-whatsapp-link")).toBeInTheDocument();
		expect(
			screen.queryByTestId("billing-support-link"),
		).not.toBeInTheDocument();
	});

	it("preserves billing CTAs alongside support link wiring", () => {
		vi.stubEnv("VITE_SUPPORT_EMAIL", "soporte@carpinteropro.app");
		render(
			<BillingBlockedScreen
				subscription={makeSub({ status: "past_due" })}
				onStartPayment={vi.fn()}
			/>,
		);

		expect(
			screen.getByRole("button", { name: /Actualizar pago/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Cerrar sesión/i }),
		).toBeInTheDocument();
		expect(screen.getByTestId("billing-support-link")).toBeInTheDocument();
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
