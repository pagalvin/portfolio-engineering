import type { PredictionDashboardStatsResponse } from '@portfolio-engineering/shared-types/intuitionLedger'
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/ui/chart'
import { ChartCard, ChartTable, ChartTableRow } from './ChartCard'

function sharedDomain(stats: PredictionDashboardStatsResponse): [number, number] {
  const values = stats.scatterPoints.flatMap((point) => [point.predictedPercent, point.actualPercent])
  if (values.length === 0) return [-10, 10]
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const padding = Math.max((max - min) * 0.08, 1)
  return [Math.floor(min - padding), Math.ceil(max + padding)]
}

export function PredictedVsActualChart({ stats }: { stats: PredictionDashboardStatsResponse }) {
  const hasData = stats.scatterPoints.length > 0
  const domain = sharedDomain(stats)
  const caption = `Includes ${stats.scatterPoints.length} ${stats.scatterPoints.length === 1 ? 'prediction' : 'predictions'} with both a predicted and an actual price.`

  return (
    <ChartCard
      title="Predicted vs. actual % change"
      description="Each point is one prediction. Points on the dashed line were predicted exactly."
      table={(
        <ChartTable caption="Predicted compared with actual percent change" headers={['Symbol', 'Predicted % change', 'Actual % change']}>
          {stats.scatterPoints.map((point) => (
            <tr key={point.predictionId}>
              <th scope="row" className="px-2 py-2 font-medium">{point.symbol ?? 'No symbol'}</th>
              <td className="px-2 py-2">{point.predictedPercent}%</td>
              <td className="px-2 py-2">{point.actualPercent}%</td>
            </tr>
          ))}
          {!hasData && <ChartTableRow colSpan={3}>No predictions have both prices recorded yet.</ChartTableRow>}
        </ChartTable>
      )}
    >
      {hasData ? (
        <>
          <ChartContainer
            config={{ prediction: { label: 'Predictions', color: 'var(--chart-1)' } }}
            className="h-64 w-full aspect-auto"
            role="img"
            aria-label="Scatter plot comparing predicted and actual percent change"
          >
            <ScatterChart accessibilityLayer margin={{ top: 12, right: 16, bottom: 16, left: 8 }}>
              <CartesianGrid />
              <XAxis
                type="number"
                dataKey="predictedPercent"
                name="Predicted"
                domain={domain}
                tickFormatter={(value: number) => `${value}%`}
                label={{ value: 'Predicted % change', position: 'insideBottom', offset: -8 }}
              />
              <YAxis
                type="number"
                dataKey="actualPercent"
                name="Actual"
                domain={domain}
                tickFormatter={(value: number) => `${value}%`}
                label={{ value: 'Actual % change', angle: -90, position: 'insideLeft' }}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
              <ReferenceLine
                segment={[{ x: domain[0], y: domain[0] }, { x: domain[1], y: domain[1] }]}
                stroke="var(--chart-2)"
                strokeDasharray="5 5"
                label={{ value: 'Predicted = actual', position: 'insideTopRight' }}
              />
              <Scatter data={stats.scatterPoints} name="Prediction" fill="var(--color-prediction)" />
            </ScatterChart>
          </ChartContainer>
          <p className="mt-2 text-sm text-text-muted">{caption}</p>
          <p className="text-xs text-text-muted">Dashed line: Predicted = actual.</p>
        </>
      ) : <p className="py-12 text-center text-sm text-text-muted">No predictions have both prices recorded yet.</p>}
    </ChartCard>
  )
}