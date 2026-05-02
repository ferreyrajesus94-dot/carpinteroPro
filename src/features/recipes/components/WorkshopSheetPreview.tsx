import { useMemo } from 'react'
import { Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { generateTemplateWorkshopSheetPDF } from '../lib/pdf'
import type { FurnitureTemplateWithItems } from '../types'
import type { WorkshopSettings } from '@/shared/types/workshop'

interface WorkshopSheetPreviewProps {
  template: FurnitureTemplateWithItems
  settings: WorkshopSettings | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkshopSheetPreview({ template, settings, open, onOpenChange }: WorkshopSheetPreviewProps) {
  const pieces = useMemo(
    () => (template.recipe_pieces ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [template.recipe_pieces]
  )

  const groups = useMemo(() => {
    const map = new Map<string, typeof pieces>()
    for (const p of pieces) {
      const key = p.material?.name ?? 'Sin material asignado'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [pieces])

  const dims = [template.height_cm, template.width_cm, template.depth_cm]
  const hasDims = dims.every((v) => v != null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start justify-between gap-4 pr-6">
            <div>
              <span>Hoja de taller — {template.name}</span>
              {hasDims && (
                <p className="text-sm font-normal text-muted-foreground mt-0.5">
                  {template.height_cm} × {template.width_cm} × {template.depth_cm} cm (A×An×P)
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => generateTemplateWorkshopSheetPDF({ template, settings })}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Descargar PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {pieces.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground italic">
            No hay despiece cargado. Editá la plantilla para agregar las piezas.
          </p>
        ) : (
          <div className="space-y-4 mt-2">
            {Array.from(groups).map(([matName, groupPieces]) => (
              <div key={matName}>
                {/* Material header */}
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-t px-3 py-1.5">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                    {matName}
                  </span>
                </div>

                {/* Pieces table */}
                <div className="border border-t-0 border-line rounded-b overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground">
                        <th className="text-left px-3 py-2 font-medium">Pieza</th>
                        <th className="text-right px-3 py-2 font-medium">Largo</th>
                        <th className="text-right px-3 py-2 font-medium">Ancho</th>
                        <th className="text-right px-3 py-2 font-medium">Esp.</th>
                        <th className="text-right px-3 py-2 font-medium">Cant.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupPieces.map((p, i) => (
                        <tr
                          key={p.id}
                          className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                        >
                          <td className="px-3 py-2 font-medium">{p.piece_name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {Number(p.length_cm).toFixed(1)} cm
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {Number(p.width_cm).toFixed(1)} cm
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {p.thickness_mm != null ? `${Number(p.thickness_mm)} mm` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            {p.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
