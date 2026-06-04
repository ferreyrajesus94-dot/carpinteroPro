import { OnboardingWizard } from "@/features/onboarding/components/OnboardingWizard";
import type {
	OnboardingMaterialInput,
	OnboardingWorkshopSettingsInput,
} from "@/features/onboarding/types";
import { useCreateMaterial } from "@/features/inventory/hooks/useMaterials";
import { useUpsertWorkshopSettings } from "@/features/settings/hooks/useWorkshopSettings";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";

export function OnboardingPage() {
	const workshopId = useWorkshopId();
	const upsertSettings = useUpsertWorkshopSettings(workshopId);
	const createMaterial = useCreateMaterial(workshopId);

	return (
		<OnboardingWizard
			onSaveWorkshopSettings={(settings: OnboardingWorkshopSettingsInput) =>
				upsertSettings.mutateAsync(settings)
			}
			onCreateMaterial={(material: OnboardingMaterialInput) =>
				createMaterial.mutateAsync(material)
			}
			isSavingWorkshopSettings={upsertSettings.isPending}
			isCreatingMaterial={createMaterial.isPending}
		/>
	);
}
