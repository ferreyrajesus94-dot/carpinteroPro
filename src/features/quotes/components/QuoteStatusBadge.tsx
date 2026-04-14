import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../types'
import type { QuoteStatus } from '../types'

interface QuoteStatusBadgeProps {
  status: QuoteStatus
}

export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[status]}`}
    >
      {QUOTE_STATUS_LABELS[status]}
    </span>
  )
}
