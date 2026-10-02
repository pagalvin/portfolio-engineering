import type { PredictionDashboardStatsResponse } from '@portfolio-engineering/shared-types/intuitionLedger'
import { useContext } from 'react'
import { ApiClientContext } from '../../apiClientContext'
import { HelpTooltip } from '../../components/HelpTooltip'
import { intuitionLedgerHelpFallbacks } from '../intuitionLedgerHelpFallbacks'
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/ui/chart'
import { ChartCard, ChartTable, ChartTableRow } from './ChartCard'
import { calibrationActualBarFill, formatHitRate } from './chartUtils'

const confidenceMidpoint: Record<PredictionDashboardStatsResponse['calibration'][number]['bucket'], number> = {
  '50-59': 55,
  '60-69': 65,
  '70-79': 75,
  '80-89': 85,
  '90-100': 95,
}

function bucketLabel(bucket: PredictionDashboardStatsResponse['calibration'][number]['bucket']): string {
  return `${bucket.replace('-', '–')}%`
}

export function CalibrationChart({ stats }: { stats: PredictionDashboardStatsResponse }) {
  const client = useContext(ApiClientContext)
  const lowSample = stats.calibration.some((bucket) => bucket.lowSample)
  const data = stats.calibration.map((bucket) => ({
    bucket: bucketLabel(bucket.bucket),
    countLabel: `n = ${bucket.count}`,
    confidence: confidenceMidpoint[bucket.bucket],
    actualHitRate: bucket.hitRate === null ? null : bucket.hitRate * 100,
    lowSample: bucket.lowSample,
  }))

  return (
    <ChartCard
      title="Calibration"
      titleAction={<HelpTooltip client={client} helpKey="help.learning.intuition-ledger.calibration" label="About calibration" relatedPageKey="help.learning.intuition-ledger" fallback={intuitionLedgerHelpFallbacks.calibration} />}
      description="Your stated confidence compared with your actual hit rate."
      table={(
        <>
          {lowSample && <p className="mb-3 text-sm text-text-muted">Some confidence levels have fewer than 5 predictions, so their results aren't meaningful yet.</p>}
          <ChartTable caption="Calibration by confidence bucket" headers={['Confidence', 'Predictions', 'Correct', 'Hit rate']}>
            {stats.calibration.map((bucket) => (
              <tr key={bucket.bucket}>
                <td className="px-2 py-2">{bucketLabel(bucket.bucket)}</td>
                <td className="px-2 py-2">n = {bucket.count}{bucket.lowSample ? ' (fewer than 5; not yet meaningful)' : ''}</td>
                <td className="px-2 py-2">{bucket.correct}</td>
                <td className="px-2 py-2">{formatHitRate(bucket.hitRate)}</td>
              </tr>
            ))}
            {stats.calibration.length === 0 && <ChartTableRow colSpan={4}>No calibration data yet.</ChartTableRow>}
          </ChartTable>
        </>
      )}
    >
      {lowSample && <p className="mb-3 rounded-md border-l-4 border-chart-2 bg-surface-muted px-3 py-2 text-sm" role="note">Some confidence levels have fewer than 5 predictions, so their results aren't meaningful yet.</p>}
      {data.length > 0 ? (
        <>
          <ChartContainer
            config={{
              confidence: { label: 'Your stated confidence', color: 'var(--chart-1)' },
              actualHitRate: { label: 'Actual hit rate', color: 'var(--chart-2)' },
            }}
            className="h-64 w-full aspect-auto"
            role="img"
            aria-label="Calibration grouped bars by confidence bucket, with prediction counts"
          >
            <BarChart data={data} accessibilityLayer margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <defs>
                <pattern id="calibration-low-sample" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="var(--color-surface-default)" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-2)" strokeWidth="2" />
                </pattern>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickFormatter={(value: string, index: number) => `${value} (${data[index]?.countLabel ?? 'n = 0'})`} interval={0} height={42} />
              <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} width={44} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => typeof value === 'number' ? `${Math.round(value)}%` : 'Not available'} />} />
              <Bar dataKey="confidence" name="Your stated confidence" fill="var(--color-confidence)" />
              <Bar dataKey="actualHitRate" name="Actual hit rate" fill="var(--color-actualHitRate)">
                {data.map((bucket) => <Cell key={bucket.bucket} fill={calibrationActualBarFill(bucket.lowSample)} />)}
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            <span><span aria-hidden="true" className="mr-1 inline-block h-3 w-3 rounded-sm bg-chart-1" />Your stated confidence</span>
            <span><span aria-hidden="true" className="mr-1 inline-block h-3 w-3 rounded-sm bg-chart-2" />Actual hit rate</span>
            {lowSample && <span>Hatched bars: fewer than 5 predictions (not yet meaningful)</span>}
          </div>
        </>
      ) : <p className="py-12 text-center text-sm text-text-muted">No calibration data yet.</p>}
    </ChartCard>
  )
}