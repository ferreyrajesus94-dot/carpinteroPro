import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Material } from '../types'
import { buildMaterialsCsv, exportMaterialsCsv } from './exportMaterialsCsv'

const BASE: Material = {
  id: 'm-1',
  workshop_id: 'w-1',
  name: 'Madera MDF 18mm',
  category: 'madera',
  unit: 'm2',
  price_per_unit: 2500,
  stock: 10,
  min_stock: 5,
  notes: null,
  wood_subtype: 'placa',
  length_cm: 244,
  width_cm: 122,
  thickness_cm: 1.8,
  volume_ml: null,
  pack_size: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('buildMaterialsCsv', () => {
  it('incluye BOM UTF-8 al inicio', () => {
    const csv = buildMaterialsCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('escribe encabezados en la primera línea', () => {
    const csv = buildMaterialsCsv([])
    const firstLine = csv.slice(1).split('\r\n')[0]
    expect(firstLine).toBe(
      'Nombre,Categoría,Unidad,Precio/u,Stock,Stock mínimo,Valor total,Subtipo,Largo (cm),Ancho (cm),Espesor (cm),Volumen (ml),Pack',
    )
  })

  it('calcula valor total (stock × precio) por fila', () => {
    const csv = buildMaterialsCsv([BASE])
    const row = csv.slice(1).split('\r\n')[1]
    // stock 10 × price 2500 = 25000
    expect(row).toContain(',25000,')
  })

  it('usa label español de la categoría y subtipo', () => {
    const csv = buildMaterialsCsv([BASE])
    const row = csv.slice(1).split('\r\n')[1]
    expect(row).toContain('Madera')
    expect(row).toContain('Placa')
  })

  it('escapa comas y comillas envolviendo en "" y duplicando comillas', () => {
    const weird: Material = { ...BASE, name: 'MDF "grueso", 18mm' }
    const csv = buildMaterialsCsv([weird])
    const row = csv.slice(1).split('\r\n')[1]
    expect(row.startsWith('"MDF ""grueso"", 18mm",')).toBe(true)
  })

  it('emite celdas vacías para dimensiones/volumen nulos', () => {
    const nulled: Material = {
      ...BASE,
      wood_subtype: null,
      length_cm: null,
      width_cm: null,
      thickness_cm: null,
      volume_ml: null,
    }
    const csv = buildMaterialsCsv([nulled])
    const row = csv.slice(1).split('\r\n')[1]
    // termina con 6 celdas vacías consecutivas (subtipo, largo, ancho, espesor, volumen, pack)
    expect(row.endsWith(',,,,,,')).toBe(true)
  })
})

describe('exportMaterialsCsv', () => {
  let createdAnchors: HTMLAnchorElement[] = []
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createdAnchors = []
    createObjectURLSpy = vi.fn(() => 'blob:mock-url')
    revokeObjectURLSpy = vi.fn()
    // @ts-expect-error jsdom
    URL.createObjectURL = createObjectURLSpy
    // @ts-expect-error jsdom
    URL.revokeObjectURL = revokeObjectURLSpy

    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLElement
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement
        anchor.click = vi.fn()
        createdAnchors.push(anchor)
      }
      return el
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dispara descarga con filename inventario-YYYY-MM-DD.csv', () => {
    exportMaterialsCsv([BASE])
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    const anchor = createdAnchors[0]
    expect(anchor).toBeDefined()
    expect(anchor.download).toMatch(/^inventario-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1)
  })
})
