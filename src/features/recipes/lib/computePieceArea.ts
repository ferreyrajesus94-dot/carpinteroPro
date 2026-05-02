// Cálculo del área total ocupada por las piezas, agrupada por material.
// Las dimensiones vienen en cm; el área se devuelve en m² para que el carpintero
// la pueda comparar visualmente con la cantidad de placas declaradas en la BOM.

export interface PieceLike {
  length_cm: number | null | undefined
  width_cm: number | null | undefined
  quantity: number | null | undefined
  material_id?: string | null | undefined
}

export interface AreaByMaterial {
  materialId: string | null
  totalM2: number
  pieces: number
}

export function computePieceArea(piece: PieceLike): number {
  const l = Number(piece.length_cm) || 0
  const w = Number(piece.width_cm) || 0
  const q = Number(piece.quantity) || 0
  if (l <= 0 || w <= 0 || q <= 0) return 0
  return (l * w * q) / 10000
}

export function computeAreaByMaterial(pieces: PieceLike[]): AreaByMaterial[] {
  const buckets = new Map<string | null, AreaByMaterial>()
  for (const p of pieces) {
    const key = p.material_id ?? null
    const m2 = computePieceArea(p)
    const existing = buckets.get(key)
    if (existing) {
      existing.totalM2 += m2
      existing.pieces += Number(p.quantity) || 0
    } else {
      buckets.set(key, {
        materialId: key,
        totalM2: m2,
        pieces: Number(p.quantity) || 0,
      })
    }
  }
  return Array.from(buckets.values())
}
