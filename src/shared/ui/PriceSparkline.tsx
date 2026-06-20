import { LineChart, Line, ResponsiveContainer } from 'recharts'

/**
 * Resolves the chart color variable based on price trend direction.
 * Uses inverted color semantics: upward trend → chart-down (cost increase = bad),
 * downward trend → chart-up (cost decrease = good), flat → chart-neutral.
 */
export function resolveSparklineColor(first: number, last: number): string {
  return last > first ? 'var(--chart-down)' : last < first ? 'var(--chart-up)' : 'var(--chart-neutral)'
}

export interface SparklinePoint {
  date: string
  price: number
}

interface Props {
  data: SparklinePoint[]
  width?: number
  height?: number
}

export function PriceSparkline({ data, width = 80, height = 24 }: Props) {
  if (data.length < 2) {
    return (
      <span
        className="text-muted-foreground inline-block text-center text-xs"
        style={{ width, height, lineHeight: `${height}px` }}
      >
        —
      </span>
    )
  }

  const first = data[0].price
  const last = data[data.length - 1].price
  const color = resolveSparklineColor(first, last)

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
