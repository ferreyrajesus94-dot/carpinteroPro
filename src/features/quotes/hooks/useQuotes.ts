import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchQuotes,
  fetchQuotesPaginated,
  fetchQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  generateQuoteNumber,
} from '../api/quotes'
import type { QuoteInsert, QuoteUpdate, QuoteExtraInsert } from '../types'

const QUOTES_KEY = 'quotes'

export function useQuotes(workshopId: string) {
  return useQuery({
    queryKey: [QUOTES_KEY, workshopId],
    queryFn: () => fetchQuotes(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useQuotesPaginated(workshopId: string, page: number) {
  return useQuery({
    queryKey: [QUOTES_KEY, workshopId, 'page', page],
    queryFn: () => fetchQuotesPaginated(workshopId, page),
    enabled: Boolean(workshopId),
    placeholderData: (prev) => prev,
  })
}

export function useQuote(id: string | null) {
  return useQuery({
    queryKey: [QUOTES_KEY, id],
    queryFn: () => fetchQuote(id!),
    enabled: Boolean(id),
  })
}

export function useGenerateQuoteNumber(workshopId: string) {
  return useQuery({
    queryKey: [QUOTES_KEY, 'next_number', workshopId],
    queryFn: () => generateQuoteNumber(workshopId),
    enabled: Boolean(workshopId),
    staleTime: 0,
  })
}

interface CreatePayload {
  quote: Omit<QuoteInsert, 'id' | 'created_at' | 'updated_at'>
  extras: Omit<QuoteExtraInsert, 'id' | 'quote_id'>[]
}

export function useCreateQuote(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ quote, extras }: CreatePayload) => createQuote(quote, extras),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, workshopId] })
      queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, 'next_number', workshopId] })
      toast.success('Presupuesto creado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

interface UpdatePayload {
  id: string
  quote: QuoteUpdate
  extras: Omit<QuoteExtraInsert, 'id' | 'quote_id'>[]
}

export function useUpdateQuote(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, quote, extras }: UpdatePayload) => updateQuote(id, quote, extras),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, workshopId] })
      queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, variables.id] })
      toast.success('Presupuesto actualizado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteQuote(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, workshopId] })
      toast.success('Presupuesto eliminado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
