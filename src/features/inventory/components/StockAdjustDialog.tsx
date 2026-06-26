import { useState, type FormEvent } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { useApplyStockMovement } from '../hooks/useStockMovements'
import type { Material } from '../types'
import type { StockMovementReason } from '../api/stockMovements'

interface StockAdjustDialogProps {
  material: Material
  onSuccess: () => void
  onCancel: () => void
}

type Direction = 'in' | 'out'

const REASONS_IN: { value: StockMovementReason; label: string }[] = [
  { value: 'compra', label: 'Compra' },
  { value: 'ajuste', label: 'Ajuste (corrección)' },
]

const REASONS_OUT: { value: StockMovementReason; label: string }[] = [
  { value: 'consumo', label: 'Consumo' },
  { value: 'merma', label: 'Merma / rotura' },
  { value: 'ajuste', label: 'Ajuste (corrección)' },
]

export function StockAdjustDialog({ material, onSuccess, onCancel }: StockAdjustDialogProps) {
  const mutation = useApplyStockMovement()

  const [direction, setDirection] = useState<Direction>('in')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState<StockMovementReason>('compra')
  const [note, setNote] = useState('')
  const [usePackMode, setUsePackMode] = useState(false)

  const reasonsList = direction === 'in' ? REASONS_IN : REASONS_OUT
  const parsedAmount = Number(amount)
  const isValid = amount !== '' && parsedAmount > 0

  const packSize = material.pack_size ?? null
  const packModeActive = usePackMode && packSize != null && direction === 'in'
  const effectiveAmount = packModeActive && packSize ? parsedAmount * packSize : parsedAmount

  const resultingStock =
    isValid ? material.stock + (direction === 'in' ? effectiveAmount : -effectiveAmount) : null
  const wouldGoNegative = resultingStock !== null && resultingStock < 0

  function handleDirectionChange(next: Direction) {
    setDirection(next)
    setReason(next === 'in' ? 'compra' : 'consumo')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || wouldGoNegative) return

    const delta = direction === 'in' ? effectiveAmount : -effectiveAmount
    mutation.mutate(
      {
        materialId: material.id,
        delta,
        reason,
        note: note.trim() || null,
      },
      { onSuccess: () => onSuccess() },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md border p-3 text-sm">
        <p className="font-medium">{material.name}</p>
        <p className="text-muted-foreground">
          Stock actual: <strong>{material.stock}</strong> {material.unit}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={direction === 'in' ? 'default' : 'outline'}
          onClick={() => handleDirectionChange('in')}
        >
          Ingresar stock (+)
        </Button>
        <Button
          type="button"
          variant={direction === 'out' ? 'default' : 'outline'}
          onClick={() => handleDirectionChange('out')}
        >
          Restar stock (−)
        </Button>
      </div>

      {packSize != null && direction === 'in' && (
        <div className="flex items-center justify-between rounded-md border p-3">
          <Label htmlFor="pack-mode" className="text-sm font-normal">
            Cargar por packs de {packSize}
          </Label>
          <Switch
            id="pack-mode"
            checked={usePackMode}
            onCheckedChange={setUsePackMode}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="stock-amount">
          Cantidad {packModeActive ? '(packs)' : ''}
        </Label>
        <Input
          id="stock-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          required
        />
        {packModeActive && isValid && (
          <p className="text-muted-foreground text-xs">
            ≈ {effectiveAmount} {material.unit}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stock-reason">Motivo</Label>
        <Select value={reason} onValueChange={(v) => setReason(v as StockMovementReason)}>
          <SelectTrigger id="stock-reason"><SelectValue /></SelectTrigger>
          <SelectContent>
            {reasonsList.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stock-note">Nota (opcional)</Label>
        <Textarea
          id="stock-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Ej: Compra a proveedor X, factura #123"
        />
      </div>

      {resultingStock !== null && (
        <p className={`text-sm ${wouldGoNegative ? 'text-destructive' : 'text-muted-foreground'}`}>
          Stock resultante: <strong>{resultingStock}</strong> {material.unit}
          {wouldGoNegative && ' — no puede quedar negativo'}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid || wouldGoNegative || mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : 'Guardar movimiento'}
        </Button>
      </div>
    </form>
  )
}
