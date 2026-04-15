import type { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import type { FurnitureTemplateWithItems } from '@/features/recipes/types'
import type { QuoteFormValues } from '../types'

interface FurnitureSectionProps {
  templates: FurnitureTemplateWithItems[]
  templateIdWatch: string | undefined
  register: UseFormRegister<QuoteFormValues>
  errors: FieldErrors<QuoteFormValues>
  setValue: UseFormSetValue<QuoteFormValues>
}

export function FurnitureSection({
  templates,
  templateIdWatch,
  register,
  errors,
  setValue,
}: FurnitureSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mueble</h2>
      <div className="space-y-1">
        <Label>Plantilla de mueble (opcional)</Label>
        <Select
          value={templateIdWatch ?? ''}
          onValueChange={(v) => setValue('furniture_template_id', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sin plantilla — ingresá nombre y costo manualmente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Sin plantilla</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="furniture_name">Nombre del mueble *</Label>
        <Input
          id="furniture_name"
          {...register('furniture_name')}
          placeholder="Ej: Ropero 2 puertas"
        />
        {errors.furniture_name && (
          <p className="text-destructive text-xs">{errors.furniture_name.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="recipe_cost">Costo base ($)</Label>
        <Input
          id="recipe_cost"
          type="number"
          min="0"
          step="0.01"
          {...register('recipe_cost')}
          placeholder="0"
        />
      </div>
    </section>
  )
}
