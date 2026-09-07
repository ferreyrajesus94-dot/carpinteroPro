import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { DashboardStats } from '../hooks/useDashboardStats'
import { Eyebrow } from '@/shared/ui/eyebrow'
import { formatCurrency } from '@/shared/lib/formatters'

interface Props {
  data: DashboardStats['revenueByMonth']
}

// Compact es-AR formatter: e.g. $1,5 M for ~1.5M ARS, $850 K for hundreds of thousands.
// Matches Argentine carpintero quoting conventions and stays readable across the
// 0–10M range the dashboard hero covers.
const compactCurrencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  notation: 'compact',
  maximumFractionDigits: 1,
})

function formatYAxis(value: number): string {
  return compactCurrencyFormatter.format(value)
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const value = payload[0].value as number
  const formatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
  return (
    <div className="rounded-lg border border-line bg-cp-surface px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-ink">{label}</p>
      <p className="font-mono text-cp-accent">{formatted}</p>
    </div>
  )
}

export function RevenueChart({ data }: Props) {
  return (
    <div className="rounded-xl border border-line bg-cp-surface p-5">
      <Eyebrow as="h3" variant="mono" className="mb-4">
        Ingresos por mes (últimos 12 meses)
      </Eyebrow>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="total" fill="var(--cp-accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>Ingresos por mes (últimos 12 meses)</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            <th scope="col">Total facturado</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, i) => (
            <tr key={i}>
              <th scope="row">{entry.month}</th>
              <td>{formatCurrency(entry.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
