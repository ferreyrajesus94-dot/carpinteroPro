import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import { useClients } from "@/features/crm";
import { ClientForm } from "@/features/crm";
import { useFurnitureTemplates } from "@/features/recipes";
import { QuoteForm } from "@/features/quotes";

/**
 * App-owned page for creating/editing quotes.
 * Composes CRM and recipes feature data into QuoteForm props,
 * respecting the feature-sliced boundary: this file lives in src/app
 * and may import from feature barrels.
 */
export function QuoteCreatorPage() {
	const workshopId = useWorkshopId();
	const { data: clients = [] } = useClients(workshopId);
	const { data: templates = [] } = useFurnitureTemplates(workshopId);

	return (
		<QuoteForm
			clients={clients}
			templates={templates}
			clientFormComponent={ClientForm}
		/>
	);
}
