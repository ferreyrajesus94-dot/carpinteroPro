import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { QUOTE_STATUS_LABELS, formatCurrency } from '@/features/quotes/types'
import type { QuoteStatus } from '@/features/quotes/types'
import type { DashboardStats } from '../hooks/useDashboardStats'

interface Props {
  data: DashboardStats['byStatus']
}

// Hex equivalents matching QUOTE_STATUS_COLORS palette
const STATUS_FILL_COLORS: Record<QuoteStatus, string> = {
  presupuesto: '#9ca3af',   // gray-400
  enviado: '#60a5fa',       // blue-400
  aprobado: '#4ade80',      // green-400
  en_produccion: '#facc15', // yellow-400
  entregado: '#34d399',     // emerald-400
  cancelado: '#f87171',     // red-400
}

type ByStatusEntry = DashboardStats['byStatus'][0]

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: ByStatusEntry }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  return (
    <div className="rounded-md border bg-background px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{QUOTE_STATUS_LABELS[entry.status]}</p>
      <p>{entry.count} {entry.count === 1 ? 'presupuesto' : 'presupuestos'}</p>
      <p className="text-muted-foreground">{formatCurrency(entry.total)}</p>
    </div>
  )
}

function CustomLegend({ payload }: { payload?: { value: string }[] }) {
  if (!payload?.length) return null
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {payload.map(entry => {
        const status = entry.value as QuoteStatus
        return (
          <li key={status} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_FILL_COLORS[status] }}
            />
            {QUOTE_STATUS_LABELS[status]}
          </li>
        )
      })}
    </ul>
  )
}

export function StatusPieChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-lg border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">Sin datos en el período</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-muted-foreground">Distribución por estado</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            cx="45%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
          >
            {data.map(entry => (
              <Cell key={entry.status} fill={STATUS_FILL_COLORS[entry.status]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            content={<CustomLegend />}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
