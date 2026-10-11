import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./LoginPage";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({
		session: null,
		loading: false,
		status: "unauthenticated",
		workshopId: null,
		onboardedAt: null,
		isPlatformAdmin: false,
		signOut: vi.fn(),
		refreshProfile: vi.fn(),
		profileIssue: null,
	}),
}));

vi.mock("@/features/auth/api", () => ({
	checkGoogleEnabled: vi.fn().mockResolvedValue(true),
	signInWithEmail: vi.fn(),
	signUpWithEmail: vi.fn(),
	signInWithGoogle: vi.fn(),
}));

function renderLogin() {
	return render(
		<MemoryRouter>
			<LoginPage />
		</MemoryRouter>,
	);
}

describe("LoginPage bundled password icons", () => {
	it("toggles password visibility and decorative eye SVG without changing names", () => {
		renderLogin();
		const input = screen.getByLabelText("Contraseña");
		const show = screen.getByRole("button", { name: "Mostrar contraseña" });
		expect(input).toHaveAttribute("type", "password");
		expect(show.querySelector("svg")).toHaveClass("lucide-eye");
		expect(show.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
		fireEvent.click(show);
		expect(input).toHaveAttribute("type", "text");
		const hide = screen.getByRole("button", { name: "Ocultar contraseña" });
		expect(hide.querySelector("svg")).toHaveClass("lucide-eye-off");
		fireEvent.click(hide);
		expect(input).toHaveAttribute("type", "password");
	});
	it("renders both failed and passed password requirements as SVGs", () => {
		renderLogin();
		fireEvent.click(screen.getByRole("button", { name: "Registrarse" }));
		fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "abc" } });
		const passed = screen.getByText("Al menos una minúscula").closest("li");
		const failed = screen.getByText("Mínimo 8 caracteres").closest("li");
		expect(passed?.querySelector("svg")).toHaveClass("lucide-check");
		expect(failed?.querySelector("svg")).toHaveClass("lucide-x");
		expect(failed?.querySelector("svg")).toHaveAttribute("width", "12");
	});
});

describe("LoginPage Google login feature flag", () => {
	beforeEach(() => {
		vi.unstubAllEnvs();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("shows the Google button when VITE_ENABLE_GOOGLE_LOGIN is undefined (default)", () => {
		renderLogin();
		const googleButtons = screen.getAllByRole("button", { name: /google/i });
		expect(googleButtons.length).toBeGreaterThan(0);
	});

	it("shows the Google button when VITE_ENABLE_GOOGLE_LOGIN is 'true'", () => {
		vi.stubEnv("VITE_ENABLE_GOOGLE_LOGIN", "true");
		renderLogin();
		const googleButtons = screen.getAllByRole("button", { name: /google/i });
		expect(googleButtons.length).toBeGreaterThan(0);
	});

	it("hides the Google button when VITE_ENABLE_GOOGLE_LOGIN is 'false'", () => {
		vi.stubEnv("VITE_ENABLE_GOOGLE_LOGIN", "false");
		renderLogin();
		expect(
			screen.queryByRole("button", { name: /google/i }),
		).not.toBeInTheDocument();
	});

	it("also hides the 'o continuá con' separator when Google is disabled", () => {
		vi.stubEnv("VITE_ENABLE_GOOGLE_LOGIN", "false");
		renderLogin();
		expect(screen.queryByText(/o continuá con/i)).not.toBeInTheDocument();
	});
});
