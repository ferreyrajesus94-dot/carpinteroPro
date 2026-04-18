import type { Material } from '../types'
import { MATERIAL_CATEGORIES, WOOD_SUBTYPES } from '../types'

const HEADERS = [
  'Nombre',
  'Categoría',
  'Unidad',
  'Precio/u',
  'Stock',
  'Stock mínimo',
  'Valor total',
  'Subtipo',
  'Largo (cm)',
  'Ancho (cm)',
  'Espesor (cm)',
  'Volumen (ml)',
  'Pack',
] as const

function escape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function categoryLabel(value: string): string {
  return MATERIAL_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

function subtypeLabel(value: string | null | undefined): string {
  if (!value) return ''
  return WOOD_SUBTYPES.find((w) => w.value === value)?.label ?? value
}

export function buildMaterialsCsv(materials: Material[]): string {
  const rows = materials.map((m) => {
    const totalValue = m.stock * m.price_per_unit
    return [
      m.name,
      categoryLabel(m.category),
      m.unit,
      m.price_per_unit,
      m.stock,
      m.min_stock,
      totalValue,
      subtypeLabel(m.wood_subtype),
      m.length_cm ?? '',
      m.width_cm ?? '',
      m.thickness_cm ?? '',
      m.volume_ml ?? '',
      m.pack_size ?? '',
    ].map(escape).join(',')
  })
  const header = HEADERS.map(escape).join(',')
  return `\uFEFF${[header, ...rows].join('\r\n')}`
}

function todayFilename(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `inventario-${yyyy}-${mm}-${dd}.csv`
}

export function exportMaterialsCsv(materials: Material[]): void {
  const csv = buildMaterialsCsv(materials)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = todayFilename()
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
