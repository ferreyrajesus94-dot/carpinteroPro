import jsPDF from 'jspdf'
import { formatCurrency } from '../types'
import { calculateQuote, type CalcExtra } from './calculator'
import type { WorkshopSettings } from '@/shared/types/workshop'
import type { QuoteWithExtras, QuotePieceSnapshot } from '../types'

export interface QuotePDFData {
  quote: QuoteWithExtras
  settings: WorkshopSettings | null
}

export function generateQuotePDF({ quote, settings }: QuotePDFData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 15
  const pageWidth = 210
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const calcResult = calculateQuote({
    recipeCost: quote.recipe_cost,
    extras: quote.extras.map((e): CalcExtra => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
    marginMode: quote.margin_mode,
    marginPct: quote.margin_pct,
  })

  if (settings?.logo_url?.startsWith('data:')) {
    try {
      const imgFormat = settings.logo_url.includes('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(settings.logo_url, imgFormat, margin, y, 20, 20)
    } catch (_) {
      // logo inválido, continuar sin él
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

  const dateStr = new Date(quote.created_at).toLocaleDateString('es-AR')
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`Presupuesto ${quote.quote_number}`, margin, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(dateStr, pageWidth - margin, y, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  y += 8

  if (quote.client) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Cliente:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(quote.client.name, margin + 18, y)
    y += 5
    if (quote.client.phone) {
      doc.text(`Tel: ${quote.client.phone}`, margin, y)
      y += 5
    }
    if (quote.client.email) {
      doc.text(`Email: ${quote.client.email}`, margin, y)
      y += 5
    }
    y += 3
  }

  const rowH = 8
  const col1 = margin
  const col2 = pageWidth - margin - 35

  doc.setFillColor(245, 245, 245)
  doc.rect(col1, y, contentWidth, rowH, 'F')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Descripción', col1 + 3, y + 5.5)
  doc.text('Precio', col2, y + 5.5, { align: 'right' })
  y += rowH

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  doc.text(quote.furniture_name, col1 + 3, y + 5.5)
  doc.text(formatCurrency(quote.recipe_cost), col2, y + 5.5, { align: 'right' })
  doc.setDrawColor(230, 230, 230)
  doc.line(col1, y + rowH, col1 + contentWidth, y + rowH)
  y += rowH

  quote.extras
    .filter((e) => e.show_in_quote)
    .forEach((e) => {
      doc.text(e.description, col1 + 3, y + 5.5)
      doc.text(formatCurrency(e.amount), col2, y + 5.5, { align: 'right' })
      doc.line(col1, y + rowH, col1 + contentWidth, y + rowH)
      y += rowH
    })

  y += 3
  doc.setDrawColor(0, 0, 0)
  doc.line(col1, y, col1 + contentWidth, y)
  y += 6
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Total', col1 + 3, y)
  doc.text(formatCurrency(calcResult.salePrice), col2, y, { align: 'right' })

  doc.save(`presupuesto-${quote.quote_number}.pdf`)
}

// ============================================================
// Hoja de taller — para los empleados que fabrican el mueble.
// Lista los cortes (despiece) tomando el snapshot congelado del quote.
// ============================================================
export interface WorkshopSheetData {
  quote: QuoteWithExtras
  settings: WorkshopSettings | null
}

export function generateWorkshopSheetPDF({ quote, settings }: WorkshopSheetData): void {
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
  doc.setTextColor(0, 0, 0)

  y += 30

  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // ── Título ──────────────────────────────────────────────────────
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Hoja de taller — ${quote.quote_number}`, margin, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(new Date().toLocaleDateString('es-AR'), pageWidth - margin, y, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  y += 8

  // ── Datos del trabajo ───────────────────────────────────────────
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Mueble:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(quote.furniture_name, margin + 22, y)
  y += 6
  if (quote.client) {
    doc.setFont('helvetica', 'bold')
    doc.text('Cliente:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(quote.client.name, margin + 22, y)
    y += 6
  }
  if (quote.notes) {
    doc.setFont('helvetica', 'bold')
    doc.text('Notas:', margin, y)
    doc.setFont('helvetica', 'normal')
    const noteLines = doc.splitTextToSize(quote.notes, contentWidth - 22)
    doc.text(noteLines, margin + 22, y)
    y += 6 * noteLines.length
  }

  y += 4
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // ── Tabla de despiece ───────────────────────────────────────────
  const pieces: QuotePieceSnapshot[] = (quote.piece_snapshots ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Despiece (cortes a realizar)', margin, y)
  y += 6

  if (pieces.length === 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(120, 120, 120)
    doc.text(
      'No hay despiece cargado para este mueble. Cargá las piezas en la plantilla del mueble para que aparezcan acá.',
      margin,
      y
    )
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    y += 6
  } else {
    // Agrupar por material
    const grouped = new Map<string, QuotePieceSnapshot[]>()
    for (const p of pieces) {
      const key = p.material_name ?? 'Sin material'
      const list = grouped.get(key) ?? []
      list.push(p)
      grouped.set(key, list)
    }

    const rowH = 7
    const cPiece = margin
    const cLargo = margin + 75
    const cAncho = margin + 105
    const cEsp = margin + 135
    const cCant = pageWidth - margin

    for (const [material, list] of grouped) {
      if (y > pageHeight - 30) {
        doc.addPage()
        y = margin
      }
      doc.setFillColor(235, 240, 255)
      doc.rect(margin, y, contentWidth, rowH, 'F')
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(material, margin + 2, y + 4.8)
      const subTotalM2 = list.reduce(
        (s, p) => s + (Number(p.length_cm) * Number(p.width_cm) * Number(p.quantity)) / 10000,
        0
      )
      doc.text(`${subTotalM2.toFixed(2)} m²`, cCant, y + 4.8, { align: 'right' })
      y += rowH

      doc.setFillColor(245, 245, 245)
      doc.rect(margin, y, contentWidth, rowH, 'F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Pieza', cPiece + 2, y + 4.8)
      doc.text('Largo', cLargo, y + 4.8)
      doc.text('Ancho', cAncho, y + 4.8)
      doc.text('Esp.', cEsp, y + 4.8)
      doc.text('Cant.', cCant, y + 4.8, { align: 'right' })
      y += rowH

      doc.setFont('helvetica', 'normal')
      for (const p of list) {
        if (y > pageHeight - 30) {
          doc.addPage()
          y = margin
        }
        doc.text(p.piece_name, cPiece + 2, y + 4.8)
        doc.text(`${Number(p.length_cm).toFixed(1)} cm`, cLargo, y + 4.8)
        doc.text(`${Number(p.width_cm).toFixed(1)} cm`, cAncho, y + 4.8)
        doc.text(p.thickness_mm != null ? `${Number(p.thickness_mm)} mm` : '—', cEsp, y + 4.8)
        doc.text(String(p.quantity), cCant, y + 4.8, { align: 'right' })
        doc.setDrawColor(230, 230, 230)
        doc.line(margin, y + rowH, margin + contentWidth, y + rowH)
        y += rowH

        if (p.notes) {
          doc.setFontSize(8)
          doc.setTextColor(100, 100, 100)
          const noteLines = doc.splitTextToSize(`↳ ${p.notes}`, contentWidth - 4)
          doc.text(noteLines, cPiece + 4, y + 3.5)
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(9)
          y += 4 * noteLines.length + 1
        }
      }
      y += 4
    }

    // Totales globales
    const totalPieces = pieces.reduce((s, p) => s + Number(p.quantity), 0)
    const totalM2 = pieces.reduce(
      (s, p) => s + (Number(p.length_cm) * Number(p.width_cm) * Number(p.quantity)) / 10000,
      0
    )
    if (y > pageHeight - 25) {
      doc.addPage()
      y = margin
    }
    doc.setDrawColor(0, 0, 0)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Total piezas:', margin, y)
    doc.text(String(totalPieces), margin + 35, y)
    doc.text('Total m²:', margin + 80, y)
    doc.text(`${totalM2.toFixed(2)} m²`, margin + 105, y)
  }

  // Footer
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(140, 140, 140)
  doc.text(
    `${settings?.name ?? 'CarpinteroPro'} · Generado el ${new Date().toLocaleDateString('es-AR')}`,
    margin,
    pageHeight - 8
  )

  doc.save(`hoja-taller-${quote.quote_number}.pdf`)
}
