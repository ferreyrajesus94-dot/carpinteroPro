import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  applyStockMovement,
  fetchStockMovements,
  type ApplyStockMovementInput,
} from '../api/stockMovements'

const STOCK_MOVEMENTS_KEY = 'stock_movements'
const MATERIALS_KEY = 'materials'

export function useStockMovements(materialId: string | null) {
  return useQuery({
    queryKey: [STOCK_MOVEMENTS_KEY, materialId],
    queryFn: () => fetchStockMovements(materialId!),
    enabled: Boolean(materialId),
  })
}

export function useApplyStockMovement(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ApplyStockMovementInput) => applyStockMovement(input),
    onSuccess: (_newStock, input) => {
      queryClient.invalidateQueries({ queryKey: [MATERIALS_KEY, workshopId] })
      queryClient.invalidateQueries({ queryKey: [STOCK_MOVEMENTS_KEY, input.materialId] })
      toast.success('Stock ajustado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
