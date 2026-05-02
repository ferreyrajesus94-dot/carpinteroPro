import type { Material } from '@/shared/types/material'

export type WoodMaterial = Pick<
  Material,
  | 'id'
  | 'name'
  | 'category'
  | 'unit'
  | 'price_per_unit'
  | 'wood_subtype'
  | 'length_cm'
  | 'width_cm'
  | 'thickness_cm'
>

export type WoodUsageMode =
  | 'placa-pieces'
  | 'placa-area'
  | 'lineal-pieces'
  | 'lineal-meters'
  | 'flat'

export interface WoodUsage {
  mode: WoodUsageMode
  inputUnitLabel: string
  piecesNeeded: number | null
  pieceLabel: string | null
  subtotal: number
}

const cm2ToM2 = (cm2: number) => cm2 / 10_000
const cmToM = (cm: number) => cm / 100
const fmt = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)

export function computeWoodUsage(material: WoodMaterial, quantity: number): WoodUsage {
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0
  const price = material.price_per_unit ?? 0
  const subtype = material.wood_subtype
  const unit = material.unit
  const len = material.length_cm
  const wid = material.width_cm

  if (subtype === 'placa') {
    const pieceLabel =
      len != null && wid != null ? `${fmt(cmToM(len))} × ${fmt(cmToM(wid))} m` : null

    if (unit === 'un' && len != null && wid != null) {
      const areaPerPiece = cm2ToM2(len * wid)
      const pieces = areaPerPiece > 0 ? Math.ceil(qty / areaPerPiece) : 0
      return { mode: 'placa-pieces', inputUnitLabel: 'm²', piecesNeeded: pieces, pieceLabel, subtotal: pieces * price }
    }
    if (unit === 'm2') {
      return { mode: 'placa-area', inputUnitLabel: 'm²', piecesNeeded: null, pieceLabel, subtotal: qty * price }
    }
  }

  if (subtype === 'liston' || subtype === 'tirante' || subtype === 'columna') {
    const pieceLabel = len != null ? `${fmt(cmToM(len))} m` : null

    if (unit === 'un' && len != null) {
      const lengthPerPiece = cmToM(len)
      const pieces = lengthPerPiece > 0 ? Math.ceil(qty / lengthPerPiece) : 0
      return { mode: 'lineal-pieces', inputUnitLabel: 'm', piecesNeeded: pieces, pieceLabel, subtotal: pieces * price }
    }
    if (unit === 'm') {
      return { mode: 'lineal-meters', inputUnitLabel: 'm', piecesNeeded: null, pieceLabel, subtotal: qty * price }
    }
  }

  return { mode: 'flat', inputUnitLabel: unit, piecesNeeded: null, pieceLabel: null, subtotal: qty * price }
}
