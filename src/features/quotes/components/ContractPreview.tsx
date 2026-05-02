import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download, Share2, Copy, Pencil, Check } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useQuote } from '../hooks/useQuotes'
import { useContractTemplates } from '../hooks/useContractTemplates'
import { useWorkshopSettings } from '@/shared/hooks/useWorkshopSettings'
import { renderContract } from '../lib/contractRenderer'
import { generateQuotePDF, generateWorkshopSheetPDF } from '../lib/pdf'
import { calculateQuote, type CalcExtra } from '../lib/calculator'
import { formatCurrency } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function ContractPreview() {
  const { id } = useParams<{ id: string }>()
  const workshopId = useWorkshopId()
  const { data: quote } = useQuote(id ?? null)
  const { data: templates = [] } = useContractTemplates(workshopId)
  const { data: settings } = useWorkshopSettings(workshopId)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContract, setEditedContract] = useState<string | null>(null)

  const defaultTemplate = templates.find((t) => t.is_default)
  const activeTemplateId = selectedTemplateId || defaultTemplate?.id || ''
  const activeTemplate = templates.find((t) => t.id === activeTemplateId)

  useEffect(() => {
    setEditedContract(null)
    setIsEditing(false)
  }, [activeTemplateId])

  if (!quote) return <div className="p-4 text-muted-foreground">Cargando...</div>

  const calcResult = calculateQuote({
    recipeCost: quote.recipe_cost,
    extras: quote.extras.map((e): CalcExtra => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
    marginMode: quote.margin_mode,
    marginPct: quote.margin_pct,
  })

  const vars = {
    client_name: quote.client?.name ?? '',
    quote_number: quote.quote_number,
    total: formatCurrency(calcResult.salePrice),
    furniture_name: quote.furniture_name,
    workshop_name: settings?.name ?? 'CarpinteroPro',
    date: format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es }),
  }

  const baseContract = activeTemplate
    ? renderContract(activeTemplate.body_markdown, vars)
    : ''
  const renderedContract = editedContract ?? baseContract

  function buildWhatsAppText(): string {
    const lines: string[] = [
      `*Presupuesto ${quote!.quote_number} — ${settings?.name ?? 'CarpinteroPro'}*`,
    ]
    if (quote!.client) lines.push(`Cliente: ${quote!.client.name}`)
    lines.push('')
    lines.push(`🪵 ${quote!.furniture_name}: ${formatCurrency(quote!.recipe_cost)}`)
    quote!.extras
      .filter((e) => e.show_in_quote)
      .forEach((e) => lines.push(`🔧 ${e.description}: ${formatCurrency(e.amount)}`))
    lines.push('─────────────────────────')
    lines.push(`*Total: ${formatCurrency(calcResult.salePrice)}*`)
    if (renderedContract) {
      const first2Lines = renderedContract
        .split('\n')
        .filter((l) => l.trim())
        .slice(0, 2)
        .join('\n')
      lines.push('')
      lines.push(first2Lines)
    }
    return lines.join('\n')
  }

  function handleWhatsApp() {
    const text = buildWhatsAppText()
    const phone = quote?.client?.phone?.replace(/\D/g, '') ?? ''
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildWhatsAppText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownloadPDF() {
    generateQuotePDF({ quote: quote!, settings: settings ?? null })
  }

  function handleDownloadWorkshopSheet() {
    generateWorkshopSheetPDF({ quote: quote!, settings: settings ?? null })
  }

  function markdownToHtml(md: string): string {
    return md
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />')
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/quotes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          Contrato — {quote.quote_number}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Plantilla:</span>
        <Select value={activeTemplateId || '__none__'} onValueChange={(v) => setSelectedTemplateId(v === '__none__' ? '' : v)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Sin contrato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin contrato</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}{t.is_default ? ' (predeterminada)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleWhatsApp}>
          <Share2 className="h-4 w-4 mr-2" />
          Compartir por WhatsApp
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Descargar PDF
        </Button>
        <Button onClick={handleDownloadWorkshopSheet} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Hoja de taller
        </Button>
        <Button onClick={handleCopy} variant="outline">
          <Copy className="h-4 w-4 mr-2" />
          {copied ? '¡Copiado!' : 'Copiar texto'}
        </Button>
      </div>

      {renderedContract ? (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false)
                } else {
                  setEditedContract(renderedContract)
                  setIsEditing(true)
                }
              }}
            >
              {isEditing ? <Check className="h-4 w-4 mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
              {isEditing ? 'Listo' : 'Editar'}
            </Button>
            {editedContract !== null && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditedContract(null)}
              >
                Restaurar plantilla
              </Button>
            )}
          </div>
          {isEditing ? (
            <Textarea
              value={editedContract ?? ''}
              onChange={(e) => setEditedContract(e.target.value)}
              rows={14}
              className="font-mono text-sm"
            />
          ) : (
            <div className="rounded-lg border p-6 bg-card text-card-foreground text-sm leading-relaxed">
              <div
                dangerouslySetInnerHTML={{ __html: markdownToHtml(renderedContract) }}
              />
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Seleccioná una plantilla para ver el contrato.
        </p>
      )}
    </div>
  )
}
