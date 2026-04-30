import { Plus, Trash2, Scissors } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { computeNesting, totalPieceAreaM2 } from '@/shared/lib/computeNesting'
import type { CutPieceInput } from '@/shared/lib/computeNesting'

export interface CutPieceDraft {
  name?: string
  length_cm: number
  width_cm: number
  quantity: number
}

interface CutPiecesSectionProps {
  pieces: CutPieceDraft[]
  boardLength: number | null
  boardWidth: number | null
  onChange: (pieces: CutPieceDraft[]) => void
}

export function CutPiecesSection({ pieces, boardLength, boardWidth, onChange }: CutPiecesSectionProps) {
  function addPiece() {
    onChange([...pieces, { name: '', length_cm: 0, width_cm: 0, quantity: 1 }])
  }

  function removePiece(i: number) {
    onChange(pieces.filter((_, idx) => idx !== i))
  }

  function updatePiece(i: number, field: keyof CutPieceDraft, value: string | number) {
    const updated = [...pieces]
    updated[i] = { ...updated[i], [field]: value }
    onChange(updated)
  }

  const validPieces: CutPieceInput[] = pieces.filter(
    (p) => p.length_cm > 0 && p.width_cm > 0 && p.quantity > 0,
  )

  const hasBoard = boardLength != null && boardLength > 0 && boardWidth != null && boardWidth > 0
  const nesting = hasBoard && validPieces.length > 0
    ? computeNesting(validPieces, boardLength!, boardWidth!)
    : null
  const areaM2 = totalPieceAreaM2(validPieces)

  return (
    <div className="mt-2 rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Scissors className="h-3.5 w-3.5" />
        Piezas a cortar
      </div>

      {pieces.length > 0 && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_60px_60px_50px_32px] gap-1 text-xs text-muted-foreground px-0.5">
            <span>Nombre</span>
            <span>Largo</span>
            <span>Ancho</span>
            <span>Cant</span>
            <span />
          </div>
          {pieces.map((piece, i) => (
            <div key={i} className="grid grid-cols-[1fr_60px_60px_50px_32px] gap-1 items-center">
              <Input
                className="h-7 text-xs"
                placeholder="Lateral, tapa…"
                value={piece.name ?? ''}
                onChange={(e) => updatePiece(i, 'name', e.target.value)}
              />
              <Input
                className="h-7 text-xs"
                type="number"
                min="0"
                step="0.5"
                placeholder="cm"
                value={piece.length_cm || ''}
                onChange={(e) => updatePiece(i, 'length_cm', Number(e.target.value))}
              />
              <Input
                className="h-7 text-xs"
                type="number"
                min="0"
                step="0.5"
                placeholder="cm"
                value={piece.width_cm || ''}
                onChange={(e) => updatePiece(i, 'width_cm', Number(e.target.value))}
              />
              <Input
                className="h-7 text-xs"
                type="number"
                min="1"
                step="1"
                placeholder="1"
                value={piece.quantity || ''}
                onChange={(e) => updatePiece(i, 'quantity', Number(e.target.value))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removePiece(i)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addPiece}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Agregar pieza
      </Button>

      {validPieces.length > 0 && (
        <div className="text-xs text-muted-foreground border-t pt-2 space-y-0.5">
          <span>
            {validPieces.reduce((s, p) => s + p.quantity, 0)} pieza
            {validPieces.reduce((s, p) => s + p.quantity, 0) !== 1 ? 's' : ''} ·{' '}
            {areaM2.toFixed(3)} m²
          </span>
          {nesting && (
            <span className="block font-medium text-foreground">
              → {nesting.boardsNeeded} placa{nesting.boardsNeeded !== 1 ? 's' : ''} necesaria
              {nesting.boardsNeeded !== 1 ? 's' : ''} ·{' '}
              {(nesting.efficiency * 100).toFixed(0)}% aprovechamiento
            </span>
          )}
          {!hasBoard && validPieces.length > 0 && (
            <span className="block text-amber-600 dark:text-amber-400">
              Cargá las medidas de la placa en el inventario para ver cuántas placas necesitás.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
