import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateQuotePDF } from './pdf'
import type { QuoteWithExtras } from '../types'

const pdfs = vi.hoisted(() => ({ documents: [] as import('jspdf').jsPDF[] }))
vi.mock('jspdf', async (importOriginal) => {
 const actual = await importOriginal<typeof import('jspdf')>()
 return { ...actual, default: class {
  constructor(options: import('jspdf').jsPDFOptions) {
   const doc = new actual.default(options)
   doc.save = vi.fn().mockReturnValue(doc)
   pdfs.documents.push(doc)
   return doc
  }
 } }
})

const quote: QuoteWithExtras = {
 id: 'q-1', workshop_id: 'w-1', quote_number: 'P-0001', client_id: null,
 furniture_template_id: null, furniture_name: 'Mesa', recipe_cost: 65000,
 status: 'aprobado', margin_mode: 'on_cost', margin_pct: 30, notes: null,
 created_at: '2026-10-08T00:00:00Z', updated_at: '2026-10-08T00:00:00Z', extras: [], client: null,
}

describe('quote and contract PDF', () => {
 beforeEach(() => { pdfs.documents = [] })
 it('keeps a quote-only document on one page', () => {
  generateQuotePDF({quote, settings: null})
  expect(pdfs.documents[0].getNumberOfPages()).toBe(1)
 })
 it('paginates a long contract and preserves its last line', () => {
  const contract = Array.from({length: 130}, (_, i) => `Contract clause ${i + 1}`).join('\n')
  generateQuotePDF({quote, settings: null, contract})
  const output = pdfs.documents[0].output()
  expect(pdfs.documents[0].getNumberOfPages()).toBe(4)
  expect(output).toContain('Contract clause 130')
  expect(output).toContain('Contrato - P-0001')
 })
})
