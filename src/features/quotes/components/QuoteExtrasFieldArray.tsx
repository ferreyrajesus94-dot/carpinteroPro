import { Controller, type Control, type FieldErrors, type UseFormRegister, useFieldArray } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import type { QuoteFormValues } from '../types'

interface QuoteExtrasFieldArrayProps {
  control: Control<QuoteFormValues>
  register: UseFormRegister<QuoteFormValues>
  errors: FieldErrors<QuoteFormValues>
}

export function QuoteExtrasFieldArray({ control, register, errors }: QuoteExtrasFieldArrayProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'extras' })

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Extras</h3>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Descripción</Label>
            <Input
              {...register(`extras.${index}.description`)}
              placeholder="Ej: Mano de obra, traslado..."
            />
            {errors.extras?.[index]?.description && (
              <p className="text-destructive text-xs">{errors.extras[index]?.description?.message}</p>
            )}
          </div>
          <div className="w-28 space-y-1">
            <Label className="text-xs text-muted-foreground">Monto</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              {...register(`extras.${index}.amount`, { valueAsNumber: true })}
              placeholder="0"
            />
          </div>
          <div className="flex flex-col items-center gap-1 pb-1">
            <Label className="text-xs text-muted-foreground">Visible</Label>
            <Controller
              control={control}
              name={`extras.${index}.show_in_quote`}
              render={({ field: f }) => (
                <Switch checked={f.value} onCheckedChange={f.onChange} />
              )}
            />
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ description: '', amount: 0, show_in_quote: true })}
      >
        <Plus className="h-4 w-4 mr-1" />
        Agregar extra
      </Button>
    </div>
  )
}
