import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { WorkshopSettings } from "./WorkshopSettings";

beforeAll(() => {
	globalThis.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
});

vi.mock("@/shared/hooks/useWorkshopId", () => ({
	useWorkshopId: () => "workshop-1",
}));

vi.mock("@/shared/ui/switch", () => ({
	Switch: ({ checked }: { checked?: boolean }) => (
		<button type="button" aria-pressed={checked ?? false} />
	),
}));

vi.mock("@/shared/hooks/useTheme", () => ({
	useTheme: () => ({
		theme: "light",
		toggle: vi.fn(),
		palette: "sawdust",
		setPalette: vi.fn(),
		density: "comfort",
		setDensity: vi.fn(),
	}),
}));

vi.mock("../hooks/useWorkshopSettings", () => {
	const settings = {
		name: "Taller Test",
		phone: null,
		email: null,
		address: null,
		logo_url: null,
		auto_stock_discount: false,
		stock_alert_enabled: false,
		default_labor_rate: null,
	};

	return {
		useWorkshopSettings: () => ({
			data: settings,
			isLoading: false,
		}),
		useUpsertWorkshopSettings: () => ({
			mutateAsync: vi.fn().mockResolvedValue(undefined),
		}),
	};
});

describe("WorkshopSettings composition contracts", () => {
	it("renders injected billing UI and calls the injected onboarding reset action", () => {
		const onResetOnboarding = vi.fn();

		render(
			<WorkshopSettings
				billingSlot={<div>Billing desde composición</div>}
				onResetOnboarding={onResetOnboarding}
			/>,
		);

		expect(screen.getByText("Billing desde composición")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));

		expect(onResetOnboarding).toHaveBeenCalledTimes(1);
	});

	it("disables the reset action while the injected onboarding reset is pending", () => {
		render(
			<WorkshopSettings onResetOnboarding={vi.fn()} isResetOnboardingPending />,
		);

		expect(
			screen.getByRole("button", { name: "Redirigiendo…" }),
		).toBeDisabled();
	});
});
