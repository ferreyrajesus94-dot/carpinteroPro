import { Dashboard } from "@/features/dashboard/components/Dashboard";
import {
 ProductionPipelineWidget,
 useQuotesWithProductionStatus,
} from "@/features/production";
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

	const production = useQuotesWithProductionStatus({
		limit: Math.max(quotes.length, 100),
	});
	const statuses = new Map(
		production.data?.map((quote) => [quote.id, quote.production_status]),
	);
	const projectedQuotes = quotes.map((quote) => ({
		...quote,
		status: statuses.get(quote.id) ?? quote.status,
	}));

	return (
		<Dashboard
			quotes={projectedQuotes}
			materials={materials}
			isLoading={isLoading || production.isLoading}
			quotesError={quotesError || production.isError}
			materialsError={materialsError}
			quotesRefetch={() => Promise.all([quotesRefetch(), production.refetch()])}
			materialsRefetch={materialsRefetch}
			productionPipelineWidget={<ProductionPipelineWidget />}
		/>
	);
}
