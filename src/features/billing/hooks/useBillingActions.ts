import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabase";

export function useCreateSubscription() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const { data, error } = await supabase.functions.invoke(
				"create-subscription",
			);
			if (error) throw error;
			return data as {
				initPoint?: string;
				preapprovalId?: string;
				status?: string;
			};
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["subscription"] });
			toast.success("Suscripción iniciada");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}

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
