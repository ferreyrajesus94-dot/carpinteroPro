import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "./OnboardingWizard";

vi.mock("@/shared/providers/AuthProvider", () => ({
	useAuth: () => ({
		session: {
			user: {
				id: "user-1",
				user_metadata: { workshop_name: "Taller Test" },
			},
		},
		loading: false,
		onboardedAt: null,
	}),
}));

vi.mock("../hooks/useOnboarding", () => ({
	useMarkOnboarded: () => ({
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	}),
}));

describe("OnboardingWizard composition contracts", () => {
	it("uses injected settings and material actions for the onboarding flow", async () => {
		const onSaveWorkshopSettings = vi.fn().mockResolvedValue(undefined);
		const onCreateMaterial = vi.fn().mockResolvedValue(undefined);

		render(
			<MemoryRouter>
				<OnboardingWizard
					onSaveWorkshopSettings={onSaveWorkshopSettings}
					onCreateMaterial={onCreateMaterial}
					isSavingWorkshopSettings={false}
					isCreatingMaterial={false}
				/>
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));

		await waitFor(() => {
			expect(onSaveWorkshopSettings).toHaveBeenCalledWith({
				name: "Taller Test",
				phone: null,
				address: null,
			});
		});

		fireEvent.click(screen.getByRole("button", { name: /Cargar/ }));

		await waitFor(() => {
			expect(onCreateMaterial).toHaveBeenCalled();
		});
	});
});
