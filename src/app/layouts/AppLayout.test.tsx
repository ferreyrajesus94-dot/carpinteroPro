import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./AppLayout";
import type { AuthStatus, ProfileIssue } from "@/shared/providers/AuthProvider";
import type { Session } from "@supabase/supabase-js";

const authMock = vi.hoisted(() => ({
	state: {
		session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } } as unknown as Session | null,
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

describe("AppLayout free-journey access", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Use the local mock supabase client so the search feature's queries
		// resolve against the in-memory mock data instead of trying to hit a
		// real Supabase instance from jsdom.
		vi.stubEnv("VITE_USE_LOCAL_MOCKS", "true");
		vi.stubEnv("VITE_DB_URL", "http://stub.local");
		vi.stubEnv("VITE_DB_ANON_KEY", "stub-anon-key");
		setAuthState({
			session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } } as unknown as Session | null,
			loading: false,
			status: "ready",
			profileIssue: null,
			onboardedAt: "2026-01-01T00:00:00Z",
			workshopId: "ws-1",
			isPlatformAdmin: false,
			signOut: vi.fn<() => Promise<void>>(),
			refreshProfile: vi.fn<() => Promise<void>>(),
		});
	});

	it("AC-1: renders the app shell when no subscription row exists", () => {
		setAuthState({ onboardedAt: "2026-01-01T00:00:00Z", workshopId: "ws-1" });

		renderWithRouter();

		// App shell renders the outlet content.
		expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
		// Brand mark and section title render too.
		expect(screen.getAllByText("CarpinteroPro").length).toBeGreaterThan(0);
	});

	it("AC-2: renders the app shell when subscription is past_due", () => {
		// The free app must never read or block on subscription state.
		setAuthState({ onboardedAt: "2026-01-01T00:00:00Z", workshopId: "ws-1" });

		renderWithRouter();

		expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
		// No "Pago pendiente" or "Acceso suspendido" must leak into the shell.
		expect(screen.queryByText(/Pago pendiente/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Acceso suspendido/i)).not.toBeInTheDocument();
	});

	it("AC-3: renders the app shell when subscription is cancelled", () => {
		setAuthState({ onboardedAt: "2026-01-01T00:00:00Z", workshopId: "ws-1" });

		renderWithRouter();

		expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
		// No blocked-screen copy leaks into the free shell.
		expect(screen.queryByText(/Suscripci[oó]n cancelada/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Acceso suspendido/i)).not.toBeInTheDocument();
	});

	it("AC-4: renders the app shell when subscription query errors", () => {
		// AppLayout no longer touches subscription state at all. A query
		// failure is impossible in the new shape, but we still assert that
		// the shell renders cleanly — fail-open, not fail-closed.
		setAuthState({ onboardedAt: "2026-01-01T00:00:00Z", workshopId: "ws-1" });

		renderWithRouter();

		expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
		expect(screen.queryByText(/Acceso suspendido/i)).not.toBeInTheDocument();
	});

	it("AC-5: unauthenticated user does NOT reach the shell", () => {
		setAuthState({
			session: null,
			status: "unauthenticated",
			onboardedAt: null,
			workshopId: null,
		});

		renderWithRouter();

		// AuthSessionLayout (rendered above AppLayout) redirects unauthenticated
		// users to /login. The shell's outlet content must not be visible.
		expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
		expect(screen.getByText("Página de login")).toBeInTheDocument();
	});
});

describe("AppLayout admin and profile recovery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("VITE_USE_LOCAL_MOCKS", "true");
		vi.stubEnv("VITE_DB_URL", "http://stub.local");
		vi.stubEnv("VITE_DB_ANON_KEY", "stub-anon-key");
		setAuthState({
			session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } } as unknown as Session | null,
			loading: false,
			status: "ready",
			profileIssue: null,
			onboardedAt: "2026-01-01T00:00:00Z",
			workshopId: "ws-1",
			isPlatformAdmin: false,
			signOut: vi.fn<() => Promise<void>>(),
			refreshProfile: vi.fn<() => Promise<void>>(),
		});
	});

	it("shows admin navigation only for platform admins", () => {
		setAuthState({ isPlatformAdmin: true });

		renderWithRouter();

		const adminLinks = screen.getAllByRole("link", { name: "Admin" });
		expect(adminLinks.length).toBeGreaterThan(0);
		expect(adminLinks[0]).toHaveAttribute("href", "/admin");
	});

	it("hides admin navigation for non-admin users", () => {
		setAuthState({ isPlatformAdmin: false });

		renderWithRouter();

		expect(
			screen.queryByRole("link", { name: "Admin" }),
		).not.toBeInTheDocument();
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
});

describe("AppLayout shell ergonomics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("VITE_USE_LOCAL_MOCKS", "true");
		vi.stubEnv("VITE_DB_URL", "http://stub.local");
		vi.stubEnv("VITE_DB_ANON_KEY", "stub-anon-key");
		setAuthState({
			session: { user: { id: "u1", email: "a@b.com", user_metadata: {} } } as unknown as Session | null,
			loading: false,
			status: "ready",
			profileIssue: null,
			onboardedAt: "2026-01-01T00:00:00Z",
			workshopId: "ws-1",
			isPlatformAdmin: false,
			signOut: vi.fn<() => Promise<void>>(),
			refreshProfile: vi.fn<() => Promise<void>>(),
		});
	});

	it("renders enabled topbar search with accessible label and placeholder", () => {
		renderWithRouter();

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

		renderWithRouter();

		const searchInput = screen.getByPlaceholderText(
			"Buscar clientes, presupuestos, materiales…",
		) as HTMLInputElement;

		await user.type(searchInput, "mesa");

		await waitFor(
			() => {
				expect(searchInput).toHaveAttribute("aria-expanded", "true");
			},
			{ timeout: 4000 },
		);
	});

	it("renders mobile theme toggle with accessible aria-label", () => {
		renderWithRouter();

		const toggles = screen.getAllByRole("button", {
			name: /Activar modo (oscuro|claro)/i,
		});
		expect(toggles.length).toBeGreaterThanOrEqual(2);
		expect(toggles[1]).toBeEnabled();
	});

	it("renders mobile interactive controls with focus-ring class", () => {
		renderWithRouter();

		const mobileToggle = screen.getAllByRole("button", {
			name: /Activar modo (oscuro|claro)/i,
		});
		const mobileToggleEl = mobileToggle[mobileToggle.length - 1];
		expect(mobileToggleEl.className).toContain("focus-ring");

		const settingsLinks = screen.getAllByRole("link", { name: "Ajustes" });
		const mobileSettings = settingsLinks.find(
			(l) => l.className.includes("h-11") && l.className.includes("w-11"),
		);
		expect(mobileSettings).toBeTruthy();
		expect(mobileSettings!.className).toContain("focus-ring");

		const profileLink = screen.getByRole("link", { name: "Mi perfil" });
		expect(profileLink.className).toContain("focus-ring");
	});

	it("renders all interactive nav elements with focus-ring class", () => {
		renderWithRouter();

		const inicioLinks = screen.getAllByRole("link", { name: "Inicio" });
		expect(inicioLinks.length).toBe(3);
		for (const link of inicioLinks) {
			expect(link.className).toContain("focus-ring");
		}

		const settingsLinks = screen.getAllByRole("link", { name: "Ajustes" });
		const sidebarSettings = settingsLinks.find(
			(l) => !l.className.includes("h-11"),
		);
		expect(sidebarSettings).toBeTruthy();
		expect(sidebarSettings!.className).toContain("focus-ring");

		const profileLink = screen.getByRole("link", { name: "Mi perfil" });
		expect(profileLink.className).toContain("focus-ring");
	});

	it("renders mobile settings and profile nav links with accessible labels", () => {
		renderWithRouter();

		const ajustesLinks = screen.getAllByRole("link", { name: "Ajustes" });
		expect(ajustesLinks.length).toBeGreaterThanOrEqual(2);
		expect(screen.getByRole("link", { name: "Mi perfil" })).toBeInTheDocument();
	});
});
