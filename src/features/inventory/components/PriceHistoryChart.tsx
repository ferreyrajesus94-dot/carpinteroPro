import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePriceHistory } from '../hooks/usePriceHistory'
import type { Material } from '../types'

interface PriceHistoryChartProps {
  material: Material
}

export function PriceHistoryChart({ material }: PriceHistoryChartProps) {
  const { data: history = [], isLoading } = usePriceHistory(material.id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Cargando historial...
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Sin cambios de precio registrados aún.
      </div>
    )
  }

  // Build chart data: one point per change + current price as last point
  const chartData = [
    ...history.map((h) => ({
      date: format(parseISO(h.changed_at), 'dd MMM yy', { locale: es }),
      precio: h.new_price,
    })),
  ]

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Precio actual: <strong>{formatCurrency(material.price_per_unit)}</strong>
        {history.length > 0 && (
          <>
            {' '}· {history.length} cambio{history.length > 1 ? 's' : ''}
          </>
        )}
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), 'Precio']}
            labelClassName="text-xs"
          />
          <Line
            type="stepAfter"
            dataKey="precio"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            className="stroke-primary"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
