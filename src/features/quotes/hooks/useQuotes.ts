import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	fetchQuotes,
	fetchQuotesPaginated,
	fetchQuote,
	createQuote,
	updateQuote,
	updateQuoteStatus,
	deleteQuote,
	generateQuoteNumber,
} from "../api/quotes";
import { captureApprovedBom } from "../api/approvedBom";
import type {
	QuoteInsert,
	QuoteUpdate,
	QuoteExtraInsert,
	QuoteStatus,
} from "../types";
import type { RecipeSnapshotInput, LaborSnapshotInput } from "../api/quotes";

const QUOTES_KEY = "quotes";

export function useQuotes(workshopId: string) {
	return useQuery({
		queryKey: [QUOTES_KEY, workshopId],
		queryFn: () => fetchQuotes(workshopId),
		enabled: Boolean(workshopId),
	});
}

export function useQuotesPaginated(workshopId: string, page: number) {
	return useQuery({
		queryKey: [QUOTES_KEY, workshopId, "page", page],
		queryFn: () => fetchQuotesPaginated(workshopId, page),
		enabled: Boolean(workshopId),
		placeholderData: (prev) => prev,
	});
}

export function useQuote(id: string | null) {
	return useQuery({
		queryKey: [QUOTES_KEY, id],
		queryFn: () => fetchQuote(id!),
		enabled: Boolean(id),
	});
}

export function useGenerateQuoteNumber(workshopId: string) {
	return useQuery({
		queryKey: [QUOTES_KEY, "next_number", workshopId],
		queryFn: () => generateQuoteNumber(workshopId),
		enabled: Boolean(workshopId),
		staleTime: 0,
	});
}

interface CreatePayload {
	quote: Omit<QuoteInsert, "id" | "created_at" | "updated_at">;
	extras: Omit<QuoteExtraInsert, "id" | "quote_id">[];
	recipeSnapshots?: RecipeSnapshotInput[];
	laborSnapshots?: LaborSnapshotInput[];
}

export function useCreateQuote(workshopId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			quote,
			extras,
			recipeSnapshots,
			laborSnapshots,
		}: CreatePayload) =>
			createQuote(quote, extras, recipeSnapshots ?? [], laborSnapshots ?? []),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, workshopId] });
			queryClient.invalidateQueries({
				queryKey: [QUOTES_KEY, "next_number", workshopId],
			});
			toast.success("Presupuesto creado");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}

interface UpdatePayload {
	id: string;
	quote: QuoteUpdate;
	extras: Omit<QuoteExtraInsert, "id" | "quote_id">[];
	recipeSnapshots?: RecipeSnapshotInput[];
	laborSnapshots?: LaborSnapshotInput[];
}

export function useUpdateQuote(workshopId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			id,
			quote,
			extras,
			recipeSnapshots,
			laborSnapshots,
		}: UpdatePayload) => {
			// Keep the edit flow from writing `en_produccion` directly.
			// That state is entered only through the production start flow
			// and is derived from the production-order state machine.
			if (quote.status === "en_produccion") {
				throw new Error(
					`No se puede escribir "en_produccion" directamente desde el editor completo: ese estado lo deriva production a partir de la orden de producción. Usá useStartProductionOrder (módulo production) para iniciar producción.`,
				);
			}
			await updateQuote(
				id,
				quote,
				extras,
				recipeSnapshots ?? [],
				laborSnapshots ?? [],
			);
			// Approved quotes capture a BOM snapshot when they transition.
			if (quote.status === "aprobado") {
				await captureApprovedBom(id);
			}
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, workshopId] });
			queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, variables.id] });
			toast.success("Presupuesto actualizado");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}

interface StatusOnlyPayload {
	id: string;
	status: QuoteStatus;
}

/**
 * Keeps the status-only mutation aligned with the edit flow: users
 * cannot write `en_produccion` directly because production derives
 * that state from the order state machine.
 */
export function useUpdateQuoteStatus(workshopId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, status }: StatusOnlyPayload) => {
			if (status === "en_produccion") {
				throw new Error(
					`No se puede escribir "en_produccion" directamente: ese estado lo deriva production a partir de la orden de producción. Usá useStartProductionOrder (módulo production) para iniciar producción.`,
				);
			}
			await updateQuoteStatus(id, status);
			// Capture approved BOM when quote transitions to aprobado
			if (status === "aprobado") {
				await captureApprovedBom(id);
			}
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, workshopId] });
			queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, variables.id] });
			toast.success("Presupuesto actualizado");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}

export function useDeleteQuote(workshopId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteQuote(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, workshopId] });
			toast.success("Presupuesto eliminado");
		},
		onError: (error: Error) => toast.error(error.message),
	});
}
