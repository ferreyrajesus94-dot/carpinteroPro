import type { MaterialInsert } from "@/shared/types/material";

export interface OnboardingWorkshopSettingsInput {
	name: string;
	phone: string | null;
	address: string | null;
}

export type OnboardingMaterialInput = Omit<MaterialInsert, "workshop_id">;
