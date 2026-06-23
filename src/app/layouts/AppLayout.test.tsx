import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
		isPlatformAdmin: false,
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

const navItemsMock = vi.hoisted(() => [
	{ to: "/dashboard", label: "Inicio", icon: "fi-rr-apps" },
]);

vi.mock("@/app/layouts/nav-items", () => ({
	NAV_ITEMS: navItemsMock,
}));

vi.mock("@/shared/components/MaintenanceBanner", () => ({
	MaintenanceBanner: () => null,
}));

import * as subscriptionModule from "@/features/billing/hooks/useSubscription";
import * as billingActionsModule from "@/features/billing/hooks/useBillingActions";

function renderWithRouter() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			<MemoryRouter initialEntries={["/dashboard"]}>
				<Routes>
					<Route path="/dashboard" element={<AppLayout />}>
						<Route index element={<div>Contenido protegido</div>} />
					</Route>
					<Route path="/login" element={<div>Página de login</div>} />
					<Route path="/onboarding" element={<div>Página de onboarding</div>} />
				</Routes>
			</MemoryRouter>,
		),
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
		// Use the local mock supabase client so the search feature's queries
		// resolve against the in-memory mock data instead of trying to hit a
		// real Supabase instance from jsdom.
		vi.stubEnv("VITE_USE_LOCAL_MOCKS", "true");
		vi.stubEnv("VITE_SUPABASE_URL", "http://stub.local");
		vi.stubEnv("VITE_SUPABASE_ANON_KEY", "stub-anon-key");
		setAuthState({
			session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } },
			loading: false,
			status: "ready",
			profileIssue: null,
			onboardedAt: "2026-01-01T00:00:00Z",
			workshopId: "ws-1",
			isPlatformAdmin: false,
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
			screen.queryByRole("link", { name: "Admin" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("status", { name: "Cargando suscripción" }),
		).not.toBeInTheDocument();
	});

	it("shows admin navigation only for platform admins", () => {
		setAuthState({ isPlatformAdmin: true });
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: activeSubscription,
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();

		const adminLinks = screen.getAllByRole("link", { name: "Admin" });
		expect(adminLinks.length).toBeGreaterThan(0);
		expect(adminLinks[0]).toHaveAttribute("href", "/admin");
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

	it("renders actionable support link on profile recovery when support email is configured", () => {
		vi.stubEnv("VITE_SUPPORT_EMAIL", "soporte@carpinteropro.app");
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

		const supportLink = screen.getByTestId("profile-recovery-support-link");
		expect(supportLink).toHaveAttribute(
			"href",
			expect.stringContaining("mailto:soporte@carpinteropro.app"),
		);
		vi.unstubAllEnvs();
	});

	it("does not render broken support link on profile recovery when support email is absent", () => {
		vi.stubEnv("VITE_SUPPORT_EMAIL", "");
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
			screen.queryByTestId("profile-recovery-support-link"),
		).not.toBeInTheDocument();
		vi.unstubAllEnvs();
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

	it("renders enabled topbar search with accessible label and placeholder", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: activeSubscription,
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();

		// The search input should be enabled and exposed to assistive tech
		const searchInput = screen.getByPlaceholderText(
			"Buscar clientes, presupuestos, materiales…",
		);
		expect(searchInput).toBeEnabled();
		expect(searchInput).toHaveAttribute("aria-label", "Buscar en tu taller");
		expect(searchInput).toHaveAttribute("aria-autocomplete", "list");
		expect(searchInput).toHaveAttribute("aria-controls", "global-search-panel");
	});

	it("opens the search panel when the user types a query", async () => {
		const user = userEvent.setup();
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: activeSubscription,
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();

		const searchInput = screen.getByPlaceholderText(
			"Buscar clientes, presupuestos, materiales…",
		) as HTMLInputElement;

		await user.type(searchInput, "mesa");

		// Debounce is 250ms; give the panel a bit longer to settle.
		// We just verify the input claims the panel is open via aria-expanded
		// — the panel's exact contents depend on the runtime supabase config
		// (mock vs. real) and are covered by dedicated search-feature unit tests.
		await waitFor(
			() => {
				expect(searchInput).toHaveAttribute("aria-expanded", "true");
			},
			{ timeout: 4000 },
		);
	});

	it("renders mobile theme toggle with accessible aria-label", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: activeSubscription,
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();

		// Both desktop and mobile theme toggles should exist
		// With theme="light" mock, label is "Activar modo oscuro"
		const toggles = screen.getAllByRole("button", {
			name: /Activar modo (oscuro|claro)/i,
		});
		expect(toggles.length).toBeGreaterThanOrEqual(2);

		// The mobile toggle should be interactive (accessible button)
		expect(toggles[1]).toBeEnabled();
	});

	it("renders mobile interactive controls with focus-ring class", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: activeSubscription,
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();

		// Mobile theme toggle button — icon-only, needs focus-ring
		const mobileToggle = screen.getAllByRole("button", {
			name: /Activar modo (oscuro|claro)/i,
		});
		// The mobile toggle is the last button (mobile header renders after desktop)
		const mobileToggleEl = mobileToggle[mobileToggle.length - 1];
		expect(mobileToggleEl.className).toContain("focus-ring");

		// The mobile header settings link uses aria-label="Ajustes"
		const settingsLinks = screen.getAllByRole("link", { name: "Ajustes" });
		// Find the mobile version by testing for h-11 w-11 (mobile icon-only style)
		const mobileSettings = settingsLinks.find(
			(l) => l.className.includes("h-11") && l.className.includes("w-11"),
		);
		expect(mobileSettings).toBeTruthy();
		expect(mobileSettings!.className).toContain("focus-ring");

		// Mobile profile link has aria-label and focus-ring
		const profileLink = screen.getByRole("link", { name: "Mi perfil" });
		expect(profileLink.className).toContain("focus-ring");
	});

	it("renders all interactive nav elements with focus-ring class", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: activeSubscription,
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();

		// Verify that every link/button in the shell has focus-ring
		// There are two "Inicio" links: sidebar + bottom nav
		const inicioLinks = screen.getAllByRole("link", { name: "Inicio" });
		expect(inicioLinks.length).toBe(2);
		for (const link of inicioLinks) {
			expect(link.className).toContain("focus-ring");
		}

		// Sidebar settings NavLink must have focus-ring
		const settingsLinks = screen.getAllByRole("link", { name: "Ajustes" });
		// The desktop sidebar settings does NOT have h-11 (it uses h-9 with text label)
		const sidebarSettings = settingsLinks.find(
			(l) => !l.className.includes("h-11"),
		);
		expect(sidebarSettings).toBeTruthy();
		expect(sidebarSettings!.className).toContain("focus-ring");

		// Sidebar profile Link must have focus-ring
		const profileLink = screen.getByRole("link", { name: "Mi perfil" });
		expect(profileLink.className).toContain("focus-ring");
	});

	it("renders mobile settings and profile nav links with accessible labels", () => {
		vi.mocked(subscriptionModule.useSubscription).mockReturnValue({
			data: activeSubscription,
			isLoading: false,
			isError: false,
			isSuccess: true,
			status: "success",
		} as unknown as ReturnType<typeof subscriptionModule.useSubscription>);

		renderWithRouter();

		// There are two "Ajustes" links (desktop sidebar + mobile header with aria-label)
		const ajustesLinks = screen.getAllByRole("link", { name: "Ajustes" });
		expect(ajustesLinks.length).toBeGreaterThanOrEqual(2);

		// The mobile header link has aria-label="Mi perfil"
		expect(screen.getByRole("link", { name: "Mi perfil" })).toBeInTheDocument();
	});
});
