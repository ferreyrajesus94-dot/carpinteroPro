import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabase";

/**
 * Cancels the current workshop's subscription.
 *
 * NOTE: This hook is kept only for the admin "cancel subscription" Edge
 * Function pathway. The user-facing app is free; there is no user-facing
 * cancel-subscription CTA anymore. Do not call this from the free journey.
 */
export function useCancelSubscription() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const { data, error } = await supabase.functions.invoke(
				"cancel-subscription",
			);
			if (error) throw error;
			return data as { status?: string };
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["subscription"] });
			toast.success("Suscripción cancelada");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}
