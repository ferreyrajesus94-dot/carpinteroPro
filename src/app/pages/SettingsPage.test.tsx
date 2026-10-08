import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";

const settingsMock = vi.hoisted(() => ({
	props: undefined as
		| {
				billingSlot?: unknown;
				onResetOnboarding?: () => void;
				isResetOnboardingPending?: boolean;
		  }
		| undefined,
	mutate: vi.fn(),
}));

vi.mock("@/features/settings/components/WorkshopSettings", () => ({
	WorkshopSettings: (props: typeof settingsMock.props) => {
		settingsMock.props = props;
		return (
			<div>
				<h1>Ajustes del taller</h1>
				<button onClick={props?.onResetOnboarding}>Reiniciar onboarding</button>
			</div>
		);
	},
}));

vi.mock("@/features/onboarding/hooks/useOnboarding", () => ({
	useResetOnboarding: () => ({ mutate: settingsMock.mutate, isPending: false }),
}));

describe("SettingsPage", () => {
	beforeEach(() => {
		settingsMock.props = undefined;
		settingsMock.mutate.mockClear();
	});

	it("renders workshop settings and keeps reset behavior without a billing slot", () => {
		render(<SettingsPage />);

		expect(screen.getByRole("heading", { name: "Ajustes del taller" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Reiniciar onboarding" }));
		expect(settingsMock.mutate).toHaveBeenCalledOnce();
		expect(settingsMock.props).not.toHaveProperty("billingSlot");
	});
});
