import type { PredictionDashboardStatsResponse } from '@portfolio-engineering/shared-types/intuitionLedger'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/ui/chart'
import { ChartCard, ChartTable, ChartTableRow } from './ChartCard'
import { formatHitRate, formatTimeSeriesLabel } from './chartUtils'

export function HitRateChart({
  stats,
  period,
}: {
  stats: PredictionDashboardStatsResponse
  period: 'week' | 'month'
}) {
  const data = stats.timeSeries.map((bucket) => ({
    label: formatTimeSeriesLabel(bucket, period),
    value: bucket.hitRate === null ? null : bucket.hitRate * 100,
  }))
  const hasData = stats.timeSeries.length > 0

  return (
    <ChartCard
      title="Hit rate over time"
      description={period === 'week' ? 'By week of resolution (Sunday–Saturday).' : 'By month of resolution.'}
      table={(
        <ChartTable caption="Hit rate over time" headers={[period === 'week' ? 'Week (Sunday–Saturday)' : 'Month', 'Hit rate', 'Resolved predictions']}>
          {stats.timeSeries.map((bucket) => (
            <tr key={bucket.bucketStart}>
              <td className="px-2 py-2">{formatTimeSeriesLabel(bucket, period)}</td>
              <td className="px-2 py-2">{formatHitRate(bucket.hitRate)}</td>
              <td className="px-2 py-2">{bucket.count}</td>
            </tr>
          ))}
          {!hasData && <ChartTableRow colSpan={3}>Not enough resolved predictions yet.</ChartTableRow>}
        </ChartTable>
      )}
    >
      {hasData ? (
        <ChartContainer
          config={{ hitRate: { label: 'Hit rate', color: 'var(--chart-1)' } }}
          className="h-64 w-full aspect-auto"
          role="img"
          aria-label={`Hit rate by ${period} of resolution date`}
        >
          <LineChart data={data} accessibilityLayer margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} width={44} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => typeof value === 'number' ? `${Math.round(value)}%` : 'Not available'} />} />
            <Line dataKey="value" name="Hit rate" type="monotone" stroke="var(--color-hitRate)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          </LineChart>
        </ChartContainer>
      ) : <p className="py-12 text-center text-sm text-text-muted">Not enough resolved predictions yet.</p>}
    </ChartCard>
  )
}