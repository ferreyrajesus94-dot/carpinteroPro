import { Dashboard } from "@/features/dashboard/components/Dashboard";
import { useMaterials } from "@/features/inventory/hooks/useMaterials";
import { useQuotes } from "@/features/quotes/hooks/useQuotes";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";

export function DashboardPage() {
	const workshopId = useWorkshopId();
	const { data: quotes = [], isLoading } = useQuotes(workshopId);
	const { data: materials = [] } = useMaterials(workshopId);

	return (
		<Dashboard quotes={quotes} materials={materials} isLoading={isLoading} />
	);
}
