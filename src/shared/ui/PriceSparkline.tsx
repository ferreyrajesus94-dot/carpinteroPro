import { LineChart, Line, ResponsiveContainer } from 'recharts'

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
  const color =
    last > first ? '#dc2626' : last < first ? '#16a34a' : '#6b7280'

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
