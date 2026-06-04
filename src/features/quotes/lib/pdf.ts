import jsPDF from 'jspdf'
import { formatCurrency } from '@/shared/lib/formatters'
import { calculateQuote, type CalcExtra } from './calculator'
import type { WorkshopSettings } from '@/shared/types/workshopSettings'
import type { QuoteWithExtras } from '../types'

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
    } catch {
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
