import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppLayout } from "./AppLayout";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({
		session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } },
		loading: false,
		onboardedAt: "2026-01-01T00:00:00Z",
		workshopId: "ws-1",
		signOut: vi.fn(),
		refreshProfile: vi.fn(),
	}),
}));

vi.mock("@/features/billing/hooks/useSubscription", () => ({
	useSubscription: vi.fn(),
}));

vi.mock("@/features/billing/hooks/useBillingActions", () => ({
	useCreateSubscription: vi.fn(),
}));

vi.mock("@/shared/hooks/useTheme", () => ({
	useTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));

vi.mock("@/shared/lib/fab", () => ({
	dispatchFab: vi.fn(),
}));

vi.mock("@/app/layouts/nav-items", () => ({
	NAV_ITEMS: [],
}));

import * as subscriptionModule from "@/features/billing/hooks/useSubscription";
import * as billingActionsModule from "@/features/billing/hooks/useBillingActions";

function renderWithRouter() {
	return render(
		<MemoryRouter initialEntries={["/dashboard"]}>
			<AppLayout />
		</MemoryRouter>,
	);
}

describe("AppLayout billing integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(billingActionsModule.useCreateSubscription).mockReturnValue({
			mutateAsync: vi.fn(),
			isPending: false,
		} as unknown as ReturnType<
			typeof billingActionsModule.useCreateSubscription
		>);
	});

	it("shows subscription loading spinner after auth is ready", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
			isSuccess: false,
			status: "pending",
		} as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();
		expect(document.querySelector(".animate-spin")).toBeInTheDocument();
	});

	it("renders app shell when subscription is active", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: {
				id: "sub-1",
				workshop_id: "ws-1",
				status: "active",
				plan: "pro_monthly",
				provider: "mercadopago",
				trial_starts_at: null,
				trial_ends_at: null,
				current_period_starts_at: null,
				current_period_ends_at: null,
				provider_subscription_id: null,
				provider_preapproval_id: null,
				provider_status: null,
				cancel_at_period_end: false,
				cancelled_at: null,
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
			},
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();
		expect(screen.getAllByText("CarpinteroPro").length).toBeGreaterThan(0);
		expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
	});

	it("renders blocked screen when subscription is past_due", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: {
				id: "sub-1",
				workshop_id: "ws-1",
				status: "past_due",
				plan: "pro_monthly",
				provider: "mercadopago",
				trial_starts_at: null,
				trial_ends_at: null,
				current_period_starts_at: null,
				current_period_ends_at: null,
				provider_subscription_id: null,
				provider_preapproval_id: null,
				provider_status: null,
				cancel_at_period_end: false,
				cancelled_at: null,
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
			},
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();
		expect(screen.getByText("Pago pendiente")).toBeInTheDocument();
	});

	it("renders blocked screen when subscription query errors (fail-closed)", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			isSuccess: false,
			status: "error",
			error: new Error("network"),
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();
		expect(screen.getByText(/Acceso suspendido/i)).toBeInTheDocument();
	});

	it("starts MercadoPago checkout from the blocked screen", async () => {
		const assign = vi.fn();
		const originalLocation = window.location;
		Object.defineProperty(window, "location", {
			configurable: true,
			value: { ...originalLocation, assign },
		});
		const mutateAsync = vi.fn().mockResolvedValue({
			initPoint: "https://www.mercadopago.com.ar/subscriptions/checkout",
		});
		vi.mocked(billingActionsModule.useCreateSubscription).mockReturnValue({
			mutateAsync,
			isPending: false,
		} as unknown as ReturnType<
			typeof billingActionsModule.useCreateSubscription
		>);
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: {
				id: "sub-1",
				workshop_id: "ws-1",
				status: "past_due",
				plan: "pro_monthly",
				provider: "mercadopago",
				trial_starts_at: null,
				trial_ends_at: null,
				current_period_starts_at: null,
				current_period_ends_at: null,
				provider_subscription_id: null,
				provider_preapproval_id: null,
				provider_status: null,
				cancel_at_period_end: false,
				cancelled_at: null,
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
			},
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();
		fireEvent.click(screen.getByRole("button", { name: /Actualizar pago/i }));

		await waitFor(() => {
			expect(mutateAsync).toHaveBeenCalledTimes(1);
			expect(assign).toHaveBeenCalledWith(
				"https://www.mercadopago.com.ar/subscriptions/checkout",
			);
		});

		Object.defineProperty(window, "location", {
			configurable: true,
			value: originalLocation,
		});
	});
});
