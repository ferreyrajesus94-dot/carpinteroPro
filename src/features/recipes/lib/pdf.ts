import jsPDF from 'jspdf'
import { formatARS } from '@/shared/lib/utils'
import { computeRecipeCost } from '../types'
import { computeWoodUsage } from './computeWoodUsage'
import type { FurnitureTemplateWithItems } from '../types'
import type { WorkshopSettings } from '@/features/quotes/types'

export interface TechnicalSheetData {
  template: FurnitureTemplateWithItems
  settings: WorkshopSettings | null
}

export function generateTechnicalSheetPDF({ template, settings }: TechnicalSheetData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 15
  const pageWidth = 210
  const pageHeight = 297
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // ── Header: logo + datos del taller ─────────────────────────────
  if (settings?.logo_url?.startsWith('data:')) {
    try {
      const imgFormat = settings.logo_url.includes('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(settings.logo_url, imgFormat, margin, y, 20, 20)
    } catch (_) {
      // logo inválido
    }
  }

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(settings?.name ?? 'CarpinteroPro', margin + 25, y + 7)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  if (settings?.phone) doc.text(settings.phone, margin + 25, y + 13)
  if (settings?.address) doc.text(settings.address, margin + 25, y + 18)
  if (settings?.email) doc.text(settings.email, margin + 25, y + 23)
  doc.setTextColor(0, 0, 0)

  y += 30

  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // ── Título ──────────────────────────────────────────────────────
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Ficha técnica', margin, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(new Date().toLocaleDateString('es-AR'), pageWidth - margin, y, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  y += 8

  // ── Foto + nombre + metadata ────────────────────────────────────
  const metaStartY = y
  if (template.photo_url?.startsWith('data:')) {
    try {
      const fmt = template.photo_url.includes('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(template.photo_url, fmt, margin, y, 35, 35)
    } catch (_) {
      // foto inválida
    }
  }
  const metaX = template.photo_url?.startsWith('data:') ? margin + 40 : margin

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(template.name, metaX, y + 5)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (template.category) {
    doc.text(`Categoría: ${template.category}`, metaX, y + 4)
    y += 5
  }
  if (template.tags && template.tags.length > 0) {
    doc.text(`Tags: ${template.tags.join(', ')}`, metaX, y + 4)
    y += 5
  }
  const dims = [template.height_cm, template.width_cm, template.depth_cm]
  if (dims.every((v) => v != null)) {
    doc.text(
      `Medidas: ${template.height_cm} × ${template.width_cm} × ${template.depth_cm} cm (A×An×P)`,
      metaX,
      y + 4
    )
    y += 5
  }
  if (template.notes) {
    const lines = doc.splitTextToSize(`Notas: ${template.notes}`, contentWidth - (metaX - margin))
    doc.text(lines, metaX, y + 4)
    y += 5 * lines.length
  }

  y = Math.max(y + 4, metaStartY + 40)

  // ── Tabla de materiales ─────────────────────────────────────────
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Materiales', margin, y)
  y += 5

  const rowH = 7
  const colName = margin
  const colQty = margin + 80
  const colWaste = margin + 115
  const colSubtotal = pageWidth - margin

  doc.setFillColor(245, 245, 245)
  doc.rect(colName, y, contentWidth, rowH, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Material', colName + 2, y + 4.8)
  doc.text('Cantidad', colQty, y + 4.8)
  doc.text('Merma', colWaste, y + 4.8)
  doc.text('Subtotal', colSubtotal, y + 4.8, { align: 'right' })
  y += rowH

  doc.setFont('helvetica', 'normal')
  let woodsTotal = 0
  let extrasTotal = 0
  for (const item of template.recipe_items) {
    if (y > pageHeight - 40) {
      doc.addPage()
      y = margin
    }
    const qty = item.quantity * (1 + (item.waste_pct ?? 0) / 100)
    const isWood = item.material.category === 'madera'
    const subtotal = isWood
      ? computeWoodUsage(item.material, qty).subtotal
      : qty * item.material.price_per_unit
    if (isWood) woodsTotal += subtotal
    else extrasTotal += subtotal

    doc.text(item.material.name, colName + 2, y + 4.8)
    doc.text(`${qty.toFixed(2)} ${item.material.unit}`, colQty, y + 4.8)
    doc.text(`${item.waste_pct ?? 0}%`, colWaste, y + 4.8)
    doc.text(formatARS(subtotal), colSubtotal, y + 4.8, { align: 'right' })
    doc.setDrawColor(230, 230, 230)
    doc.line(colName, y + rowH, colName + contentWidth, y + rowH)
    y += rowH
  }

  // ── Mano de obra ────────────────────────────────────────────────
  const laborItems = template.labor_items ?? []
  if (laborItems.length > 0) {
    y += 4
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Mano de obra', margin, y)
    y += 5

    doc.setFillColor(245, 245, 245)
    doc.rect(colName, y, contentWidth, rowH, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Descripción', colName + 2, y + 4.8)
    doc.text('Horas', colQty, y + 4.8)
    doc.text('Tarifa', colWaste, y + 4.8)
    doc.text('Subtotal', colSubtotal, y + 4.8, { align: 'right' })
    y += rowH

    doc.setFont('helvetica', 'normal')
    for (const l of laborItems) {
      if (y > pageHeight - 30) {
        doc.addPage()
        y = margin
      }
      const sub = l.hours * l.rate
      doc.text(l.description, colName + 2, y + 4.8)
      doc.text(l.hours.toString(), colQty, y + 4.8)
      doc.text(formatARS(l.rate), colWaste, y + 4.8)
      doc.text(formatARS(sub), colSubtotal, y + 4.8, { align: 'right' })
      doc.setDrawColor(230, 230, 230)
      doc.line(colName, y + rowH, colName + contentWidth, y + rowH)
      y += rowH
    }
  }

  // ── Totales ─────────────────────────────────────────────────────
  const { total, laborTotal } = computeRecipeCost(template.recipe_items, laborItems)

  y += 5
  doc.setDrawColor(0, 0, 0)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Materiales (madera)', margin, y)
  doc.text(formatARS(woodsTotal), colSubtotal, y, { align: 'right' })
  y += 5
  doc.text('Materiales (extras)', margin, y)
  doc.text(formatARS(extrasTotal), colSubtotal, y, { align: 'right' })
  y += 5
  if (laborTotal > 0) {
    doc.text('Mano de obra', margin, y)
    doc.text(formatARS(laborTotal), colSubtotal, y, { align: 'right' })
    y += 5
  }
  y += 2
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Costo total', margin, y)
  doc.text(formatARS(total), colSubtotal, y, { align: 'right' })

  doc.save(`ficha-${template.name.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}
