/**
 * Algoritmo de nesting 2D simplificado (Guillotine First-Fit Decreasing con rotación).
 * Dado un conjunto de piezas a cortar y las dimensiones de la placa de stock, calcula
 * cuántas placas se necesitan y genera un layout visual por placa.
 *
 * Limitaciones conocidas: no garantiza optimalidad (es NP-hard), pero produce resultados
 * razonables para carpintería. Las piezas se ordenan de mayor a menor área antes de colocar.
 */

export interface CutPieceInput {
  name?: string | null
  length_cm: number
  width_cm: number
  quantity: number
}

export interface PlacedPiece {
  name?: string | null
  /** Offset desde la esquina superior-izquierda de la placa, en cm. */
  x: number
  y: number
  length_cm: number
  width_cm: number
  rotated: boolean
}

export interface NestingBoard {
  index: number
  pieces: PlacedPiece[]
  /** Área usada por las piezas en cm². */
  usedArea: number
}

export interface NestingResult {
  boardsNeeded: number
  boards: NestingBoard[]
  /** Ratio de aprovechamiento 0–1 (área piezas / área total usada). */
  efficiency: number
  /** Área total de todas las piezas en cm². */
  totalPieceArea: number
  /** Área de una placa de stock en cm². */
  boardArea: number
}

interface FreeRect {
  x: number
  y: number
  w: number
  h: number
}

/** Intenta ubicar una pieza (pw × ph) en el rectángulo libre (r). Devuelve la posición si entra, null si no. */
function tryFit(
  pw: number,
  ph: number,
  r: FreeRect,
): { x: number; y: number; rotated: boolean } | null {
  if (pw <= r.w && ph <= r.h) return { x: r.x, y: r.y, rotated: false }
  if (ph <= r.w && pw <= r.h) return { x: r.x, y: r.y, rotated: true }
  return null
}

/** Corte guillotina: al colocar (pw × ph) en (r), genera hasta 2 rectángulos libres. */
function guillotineSplit(r: FreeRect, pw: number, ph: number): FreeRect[] {
  const result: FreeRect[] = []
  const rightW = r.w - pw
  const topH = r.h - ph
  // Dividir según eje más largo del sobrante
  if (rightW >= topH) {
    if (rightW > 0) result.push({ x: r.x + pw, y: r.y, w: rightW, h: r.h })
    if (topH > 0) result.push({ x: r.x, y: r.y + ph, w: pw, h: topH })
  } else {
    if (topH > 0) result.push({ x: r.x, y: r.y + ph, w: r.w, h: topH })
    if (rightW > 0) result.push({ x: r.x + pw, y: r.y, w: rightW, h: ph })
  }
  return result
}

export function computeNesting(
  pieces: CutPieceInput[],
  boardLength: number,
  boardWidth: number,
): NestingResult {
  const boardArea = boardLength * boardWidth

  // Expandir por cantidad y filtrar inválidos
  const expanded: { name?: string | null; l: number; w: number }[] = []
  for (const p of pieces) {
    if (p.length_cm > 0 && p.width_cm > 0 && p.quantity > 0) {
      for (let i = 0; i < p.quantity; i++) {
        expanded.push({ name: p.name, l: p.length_cm, w: p.width_cm })
      }
    }
  }

  if (expanded.length === 0) {
    return { boardsNeeded: 0, boards: [], efficiency: 0, totalPieceArea: 0, boardArea }
  }

  const totalPieceArea = expanded.reduce((s, p) => s + p.l * p.w, 0)

  // Ordenar de mayor a menor área
  expanded.sort((a, b) => b.l * b.w - a.l * a.w)

  const boards: NestingBoard[] = []
  const freeRects: FreeRect[][] = []

  for (const piece of expanded) {
    let placed = false

    for (let bi = 0; bi < boards.length; bi++) {
      const rects = freeRects[bi]
      // Buscar el rectángulo libre más chico que lo contenga (Best Short Side Fit)
      let bestIdx = -1
      let bestScore = Infinity

      for (let ri = 0; ri < rects.length; ri++) {
        const fit = tryFit(piece.l, piece.w, rects[ri])
        if (fit) {
          const shortSide = Math.min(
            rects[ri].w - (fit.rotated ? piece.w : piece.l),
            rects[ri].h - (fit.rotated ? piece.l : piece.w),
          )
          if (shortSide < bestScore) {
            bestScore = shortSide
            bestIdx = ri
          }
        }
      }

      if (bestIdx >= 0) {
        const r = rects[bestIdx]
        const fit = tryFit(piece.l, piece.w, r)!
        const pl = fit.rotated ? piece.w : piece.l
        const pw = fit.rotated ? piece.l : piece.w
        boards[bi].pieces.push({ name: piece.name, x: r.x, y: r.y, length_cm: pl, width_cm: pw, rotated: fit.rotated })
        boards[bi].usedArea += piece.l * piece.w
        const newRects = guillotineSplit(r, pl, pw)
        rects.splice(bestIdx, 1, ...newRects)
        placed = true
        break
      }
    }

    if (!placed) {
      // Abrir nueva placa
      const bi = boards.length
      boards.push({ index: bi, pieces: [], usedArea: 0 })
      freeRects.push([{ x: 0, y: 0, w: boardLength, h: boardWidth }])
      const r = freeRects[bi][0]
      const fit = tryFit(piece.l, piece.w, r)
      if (fit) {
        const pl = fit.rotated ? piece.w : piece.l
        const pw = fit.rotated ? piece.l : piece.w
        boards[bi].pieces.push({ name: piece.name, x: 0, y: 0, length_cm: pl, width_cm: pw, rotated: fit.rotated })
        boards[bi].usedArea += piece.l * piece.w
        const newRects = guillotineSplit(r, pl, pw)
        freeRects[bi].splice(0, 1, ...newRects)
      }
      // Si la pieza no cabe ni en una placa vacía, igual cuenta como placa (caso borde)
    }
  }

  const boardsNeeded = boards.length
  const efficiency = boardsNeeded > 0 ? totalPieceArea / (boardsNeeded * boardArea) : 0

  return { boardsNeeded, boards, efficiency, totalPieceArea, boardArea }
}

/** Calcula el área total de las piezas en m². */
export function totalPieceAreaM2(pieces: CutPieceInput[]): number {
  return pieces.reduce((s, p) => s + (p.length_cm * p.width_cm * p.quantity) / 10_000, 0)
}
