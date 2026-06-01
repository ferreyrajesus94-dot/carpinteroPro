import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import type { AuthStatus, ProfileIssue } from "@/shared/providers/AuthProvider";

const authMock = vi.hoisted(() => ({
	state: {
		session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } },
		loading: false,
		status: "ready" as AuthStatus,
		profileIssue: null as ProfileIssue | null,
		onboardedAt: "2026-01-01T00:00:00Z" as string | null,
		workshopId: "ws-1" as string | null,
		signOut: vi.fn<() => Promise<void>>(),
		refreshProfile: vi.fn<() => Promise<void>>(),
	},
}));

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => authMock.state,
}));

vi.mock("@/features/billing/hooks/useSubscription", () => ({
	useSubscription: vi.fn(),
}));

vi.mock("@/features/billing/hooks/useBillingActions", () => ({
	useCreateSubscription: vi.fn(),
	useCancelSubscription: vi.fn(),
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
			<Routes>
				<Route path="/dashboard" element={<AppLayout />}>
					<Route index element={<div>Contenido protegido</div>} />
				</Route>
				<Route path="/login" element={<div>Página de login</div>} />
				<Route path="/onboarding" element={<div>Página de onboarding</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

function setAuthState(overrides: Partial<typeof authMock.state>) {
	Object.assign(authMock.state, overrides);
}

const activeSubscription = {
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
};

describe("AppLayout billing integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setAuthState({
			session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } },
			loading: false,
			status: "ready",
			profileIssue: null,
			onboardedAt: "2026-01-01T00:00:00Z",
			workshopId: "ws-1",
			signOut: vi.fn<() => Promise<void>>(),
			refreshProfile: vi.fn<() => Promise<void>>(),
		});
		vi.mocked(billingActionsModule.useCreateSubscription).mockReturnValue({
			mutateAsync: vi.fn(),
			isPending: false,
		} as unknown as ReturnType<
			typeof billingActionsModule.useCreateSubscription
		>);
		vi.mocked(billingActionsModule.useCancelSubscription).mockReturnValue({
			mutateAsync: vi.fn(),
			isPending: false,
		} as unknown as ReturnType<
			typeof billingActionsModule.useCancelSubscription
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
		expect(
			screen.getByRole("status", { name: "Cargando suscripción" }),
		).toBeInTheDocument();
	});

	it("renders app shell when subscription is active", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: activeSubscription,
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();
		expect(screen.getAllByText("CarpinteroPro").length).toBeGreaterThan(0);
		expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
		expect(
			screen.queryByRole("status", { name: "Cargando suscripción" }),
		).not.toBeInTheDocument();
	});

	it("renders blocked screen when subscription is past_due", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: {
				...activeSubscription,
				status: "past_due",
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
				...activeSubscription,
				status: "past_due",
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

	it("shows profile error recovery screen and blocks protected shell", () => {
		setAuthState({
			status: "profile_error",
			profileIssue: {
				kind: "query_error",
				title: "No pudimos cargar tu perfil de taller",
				message: "Hubo un problema al cargar la información de tu taller.",
				retryable: true,
			},
			workshopId: null,
			onboardedAt: null,
		});

		renderWithRouter();

		expect(
			screen.getByRole("heading", {
				name: "No pudimos cargar tu perfil de taller",
			}),
		).toBeInTheDocument();
		expect(screen.getByText(/Hubo un problema al cargar/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Reintentar" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Cerrar sesión" }),
		).toBeInTheDocument();
		expect(screen.getByText(/contactá a soporte/i)).toBeInTheDocument();
		expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
		expect(screen.queryByText("CarpinteroPro")).not.toBeInTheDocument();
	});

	it("shows profile missing recovery screen instead of redirecting to onboarding", () => {
		setAuthState({
			status: "profile_missing",
			profileIssue: {
				kind: "missing_profile",
				title: "No pudimos encontrar tu perfil de taller",
				message:
					"Tu sesión está activa, pero no encontramos el perfil asociado a tu cuenta.",
				retryable: true,
			},
			workshopId: null,
			onboardedAt: null,
		});
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: activeSubscription,
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();

		expect(
			screen.getByRole("heading", {
				name: "No pudimos encontrar tu perfil de taller",
			}),
		).toBeInTheDocument();
		expect(screen.queryByText("Página de onboarding")).not.toBeInTheDocument();
	});

	it("calls refreshProfile from the recovery retry action", () => {
		const refreshProfile = vi.fn<() => Promise<void>>().mockResolvedValue();
		setAuthState({
			status: "profile_error",
			profileIssue: null,
			refreshProfile,
			workshopId: null,
			onboardedAt: null,
		});

		renderWithRouter();
		fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

		expect(refreshProfile).toHaveBeenCalledTimes(1);
	});

	it("calls signOut from the recovery logout action", () => {
		const signOut = vi.fn<() => Promise<void>>().mockResolvedValue();
		setAuthState({
			status: "profile_missing",
			profileIssue: null,
			signOut,
			workshopId: null,
			onboardedAt: null,
		});

		renderWithRouter();
		fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

		expect(signOut).toHaveBeenCalledTimes(1);
	});

	it("still redirects valid ready profiles without onboarding to onboarding", () => {
		setAuthState({
			status: "ready",
			onboardedAt: null,
			workshopId: "ws-1",
		});

		renderWithRouter();

		expect(screen.getByText("Página de onboarding")).toBeInTheDocument();
	});

	it("does not call billing hooks while profile state is inconsistent", () => {
		setAuthState({
			status: "profile_error",
			profileIssue: null,
			workshopId: null,
			onboardedAt: null,
		});

		renderWithRouter();

		expect(subscriptionModule.useSubscription).not.toHaveBeenCalled();
		expect(billingActionsModule.useCreateSubscription).not.toHaveBeenCalled();
	});
});
