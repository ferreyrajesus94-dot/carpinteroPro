import { Dashboard } from "@/features/dashboard/components/Dashboard";
import { ProductionPipelineWidget } from "@/features/production";
import { useMaterials } from "@/features/inventory/hooks/useMaterials";
import { useQuotes } from "@/features/quotes";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";

export function DashboardPage() {
	const workshopId = useWorkshopId();
	const {
		data: quotes = [],
		isLoading,
		isError: quotesError,
		refetch: quotesRefetch,
	} = useQuotes(workshopId);
	const {
		data: materials = [],
		isError: materialsError,
		refetch: materialsRefetch,
	} = useMaterials(workshopId);

	return (
		<Dashboard
			quotes={quotes}
			materials={materials}
			isLoading={isLoading}
			quotesError={quotesError}
			materialsError={materialsError}
			quotesRefetch={quotesRefetch}
			materialsRefetch={materialsRefetch}
			productionPipelineWidget={<ProductionPipelineWidget />}
		/>
	);
}
