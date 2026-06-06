import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import { useWorkshopSettings } from "@/features/settings";
import { ContractPreview } from "@/features/quotes";

/**
 * App-owned page for the quote contract preview.
 * Composes settings feature data into ContractPreview props,
 * respecting the feature-sliced boundary: this file lives in src/app
 * and may import from feature barrels or internal component paths.
 */
export function QuoteContractPage() {
	const workshopId = useWorkshopId();
	const { data: settings } = useWorkshopSettings(workshopId);

	return <ContractPreview workshopSettings={settings ?? null} />;
}
