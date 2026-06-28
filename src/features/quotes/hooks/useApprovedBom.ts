import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { captureApprovedBom, fetchApprovedBomLines } from "../api/approvedBom";
import type { ApprovedBomLine } from "../types";

const APPROVED_BOM_KEY = "approved_bom";

/**
 * Fetch the approved BOM lines for a quote.
 */
export function useApprovedBomLines(quoteId: string | null): {
	data: ApprovedBomLine[] | undefined;
	isLoading: boolean;
	isError: boolean;
} {
	return useQuery({
		queryKey: [APPROVED_BOM_KEY, quoteId],
		queryFn: () => fetchApprovedBomLines(quoteId!),
		enabled: Boolean(quoteId),
	});
}

/**
 * Capture the approved BOM for a quote.
 * Wires into approval-side flows; invalidates query cache on success.
 */
export function useCaptureApprovedBom() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (quoteId: string) => captureApprovedBom(quoteId),
		onSuccess: (_data, quoteId) => {
			queryClient.invalidateQueries({
				queryKey: [APPROVED_BOM_KEY, quoteId],
			});
			queryClient.invalidateQueries({ queryKey: ["quotes"] });
		},
		onError: (error: Error) => toast.error(error.message),
	});
}
