import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MaintenanceBanner } from "./MaintenanceBanner";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/shared/hooks/useMaintenanceMode", () => ({
	useMaintenanceMode: vi.fn(),
}));

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: vi.fn(),
}));

import { useMaintenanceMode } from "@/shared/hooks/useMaintenanceMode";
import { useAuth } from "@/shared/providers/AuthProvider";

function renderWithQuery(ui: React.ReactElement) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(createElement(QueryClientProvider, { client }, ui));
}

describe("MaintenanceBanner", () => {
	it("renders nothing when maintenance is disabled", () => {
		vi.mocked(useAuth).mockReturnValue({ isPlatformAdmin: false } as ReturnType<typeof useAuth>);
		vi.mocked(useMaintenanceMode).mockReturnValue({
			data: { enabled: false, message: "" },
		} as ReturnType<typeof useMaintenanceMode>);

		const { container } = renderWithQuery(createElement(MaintenanceBanner));
		expect(container.firstChild).toBeNull();
	});

	it("renders nothing for admin users even when maintenance is enabled", () => {
		vi.mocked(useAuth).mockReturnValue({ isPlatformAdmin: true } as ReturnType<typeof useAuth>);
		vi.mocked(useMaintenanceMode).mockReturnValue({
			data: { enabled: true, message: "En mantenimiento" },
		} as ReturnType<typeof useMaintenanceMode>);

		const { container } = renderWithQuery(createElement(MaintenanceBanner));
		expect(container.firstChild).toBeNull();
	});

	it("shows banner for non-admin when maintenance is enabled", () => {
		vi.mocked(useAuth).mockReturnValue({ isPlatformAdmin: false } as ReturnType<typeof useAuth>);
		vi.mocked(useMaintenanceMode).mockReturnValue({
			data: { enabled: true, message: "Sistema en mantenimiento programado" },
		} as ReturnType<typeof useMaintenanceMode>);

		renderWithQuery(createElement(MaintenanceBanner));

		expect(screen.getByText(/Sistema en mantenimiento programado/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Cerrar aviso" })).toBeInTheDocument();
	});

	it("dismisses banner when close button is clicked", () => {
		vi.mocked(useAuth).mockReturnValue({ isPlatformAdmin: false } as ReturnType<typeof useAuth>);
		vi.mocked(useMaintenanceMode).mockReturnValue({
			data: { enabled: true, message: "En mantenimiento" },
		} as ReturnType<typeof useMaintenanceMode>);

		renderWithQuery(createElement(MaintenanceBanner));

		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
		});

		expect(screen.queryByText(/En mantenimiento/)).not.toBeInTheDocument();
	});
});
