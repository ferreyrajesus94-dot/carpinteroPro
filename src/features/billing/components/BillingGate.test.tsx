import { afterEach, describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { BillingGate } from "./BillingGate";
import type { SubscriptionRow } from "@/features/billing/types";

const MAX_TIMEOUT_MS = 2_147_483_647;

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
		trial_ends_at: "2099-01-01T00:00:00Z",
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

describe("BillingGate", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders loading spinner while loading", () => {
		render(
			<BillingGate subscription={null} isLoading={true}>
				<div data-testid="app">App</div>
			</BillingGate>,
		);
		expect(screen.queryByTestId("app")).not.toBeInTheDocument();
		expect(
			screen.getByRole("status", { name: "Cargando suscripción" }),
		).toBeInTheDocument();
	});

	it("renders children when access is allowed", () => {
		render(
			<BillingGate
				subscription={makeSub({ status: "active" })}
				isLoading={false}
			>
				<div data-testid="app">App</div>
			</BillingGate>,
		);
		expect(screen.getByTestId("app")).toBeInTheDocument();
	});

	it("blocks access as soon as a trial expires while the app is open", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

		render(
			<BillingGate
				subscription={makeSub({
					status: "trialing",
					trial_ends_at: "2026-01-01T00:00:01.000Z",
				})}
				isLoading={false}
			>
				<div data-testid="app">App</div>
			</BillingGate>,
		);

		expect(screen.getByTestId("app")).toBeInTheDocument();

		act(() => {
			vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
			vi.advanceTimersByTime(1000);
		});

		expect(screen.queryByTestId("app")).not.toBeInTheDocument();
		expect(screen.getAllByText("Período de prueba").length).toBeGreaterThan(0);
	});

	it("reschedules long access boundaries beyond the browser timeout cap", () => {
		vi.useFakeTimers();
		const start = new Date("2026-01-01T00:00:00.000Z");
		const end = new Date(start.getTime() + MAX_TIMEOUT_MS + 1000);
		vi.setSystemTime(start);

		render(
			<BillingGate
				subscription={makeSub({
					status: "active",
					trial_ends_at: null,
					cancel_at_period_end: true,
					current_period_ends_at: end.toISOString(),
				})}
				isLoading={false}
			>
				<div data-testid="app">App</div>
			</BillingGate>,
		);

		expect(screen.getByTestId("app")).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(MAX_TIMEOUT_MS);
		});
		expect(screen.getByTestId("app")).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(screen.queryByTestId("app")).not.toBeInTheDocument();
		expect(screen.getByText("Suscripción activa")).toBeInTheDocument();
	});

	it("renders blocked screen when access is blocked", () => {
		render(
			<BillingGate
				subscription={makeSub({ status: "past_due" })}
				isLoading={false}
			>
				<div data-testid="app">App</div>
			</BillingGate>,
		);
		expect(screen.queryByTestId("app")).not.toBeInTheDocument();
		expect(screen.getByText("Pago pendiente")).toBeInTheDocument();
	});

	it("renders blocked screen when subscription is null and not loading", () => {
		render(
			<BillingGate subscription={null} isLoading={false}>
				<div data-testid="app">App</div>
			</BillingGate>,
		);
		expect(screen.queryByTestId("app")).not.toBeInTheDocument();
		expect(screen.getByText(/Acceso suspendido/i)).toBeInTheDocument();
	});
});
