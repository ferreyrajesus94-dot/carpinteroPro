import type { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'
import type { MarginMode, QuoteFormValues } from '../types'

interface MarginSectionProps {
  marginModeWatch: MarginMode
  register: UseFormRegister<QuoteFormValues>
  errors: FieldErrors<QuoteFormValues>
  setValue: UseFormSetValue<QuoteFormValues>
}

export function MarginSection({ marginModeWatch, register, errors, setValue }: MarginSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Margen</h2>
      <RadioGroup
        value={marginModeWatch}
        onValueChange={(v: string) => setValue('margin_mode', v as MarginMode)}
        className="flex gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="on_cost" id="on_cost" />
          <Label htmlFor="on_cost">Sobre el costo</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="on_price" id="on_price" />
          <Label htmlFor="on_price">Sobre el precio de venta</Label>
        </div>
      </RadioGroup>
      <div className="w-28 space-y-1">
        <Label htmlFor="margin_pct">Margen (%)</Label>
        <Input
          id="margin_pct"
          type="number"
          min="0"
          max="99"
          step="0.1"
          {...register('margin_pct')}
        />
        {errors.margin_pct && (
          <p className="text-destructive text-xs">{errors.margin_pct.message}</p>
        )}
      </div>
    </section>
  )
}
