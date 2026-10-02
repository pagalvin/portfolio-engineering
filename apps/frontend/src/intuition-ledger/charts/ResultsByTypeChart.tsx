import type { PredictionDashboardStatsResponse } from '@portfolio-engineering/shared-types/intuitionLedger'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/ui/chart'
import { ChartCard, ChartTable, ChartTableRow } from './ChartCard'
import { formatHitRate, predictionTypeLabel } from './chartUtils'

function typeRows(stats: PredictionDashboardStatsResponse) {
  return stats.byType.map((item) => ({
    ...item,
    label: predictionTypeLabel(item.type),
  }))
}

export function ResultsByTypeChart({ stats }: { stats: PredictionDashboardStatsResponse }) {
  const data = typeRows(stats)

  return (
    <ChartCard
      title="Results by type"
      description="Correct and Incorrect results for each prediction type."
      table={(
        <ChartTable caption="Results by prediction type" headers={['Prediction type', 'Correct', 'Incorrect', 'Resolved', 'Hit rate']}>
          {data.map((item) => (
            <tr key={item.type}>
              <th scope="row" className="px-2 py-2 font-medium">{item.label}</th>
              <td className="px-2 py-2"><span aria-hidden="true">✓ </span>Correct: {item.correct}</td>
              <td className="px-2 py-2"><span aria-hidden="true">✗ </span>Incorrect: {item.incorrect}</td>
              <td className="px-2 py-2">{item.count}</td>
              <td className="px-2 py-2">{formatHitRate(item.hitRate)}</td>
            </tr>
          ))}
          {data.length === 0 && <ChartTableRow colSpan={5}>No results by type yet.</ChartTableRow>}
        </ChartTable>
      )}
    >
      {data.length > 0 ? (
        <>
          <ChartContainer
            config={{ correct: { label: 'Correct', color: 'var(--chart-1)' }, incorrect: { label: 'Incorrect', color: 'var(--chart-2)' } }}
            className="h-64 w-full aspect-auto"
            role="img"
            aria-label="Stacked bars of Correct and Incorrect results by prediction type"
          >
            <BarChart data={data} layout="vertical" accessibilityLayer margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={108} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="correct" name="Correct" stackId="results" fill="var(--color-correct)" />
              <Bar dataKey="incorrect" name="Incorrect" stackId="results" fill="var(--color-incorrect)" />
            </BarChart>
          </ChartContainer>
          <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-text-muted"><span>✓ Correct</span><span>✗ Incorrect</span></p>
        </>
      ) : <p className="py-12 text-center text-sm text-text-muted">No results by type yet.</p>}
    </ChartCard>
  )
}