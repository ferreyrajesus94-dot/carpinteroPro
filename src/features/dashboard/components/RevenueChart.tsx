import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { DashboardStats } from '../hooks/useDashboardStats'

interface Props {
  data: DashboardStats['revenueByMonth']
}

function formatYAxis(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}k`
  return value.toString()
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
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-ink">{label}</p>
      <p className="font-mono text-cp-accent">{formatted}</p>
    </div>
  )
}

export function RevenueChart({ data }: Props) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h3 className="mb-4 text-[11px] uppercase tracking-[0.08em] font-medium text-ink3">
        Ingresos por mes (últimos 12 meses)
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="total" fill="var(--cp-accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
