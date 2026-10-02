import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader } from '../../components/ui/card'

interface ChartCardProps {
  title: string
  description: string
  children: ReactNode
  table: ReactNode
  titleAction?: ReactNode
}

export function ChartCard({ title, description, children, table, titleAction }: ChartCardProps) {
  const id = useId().replace(/:/g, '')
  const [showTable, setShowTable] = useState(false)

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
        <div className="min-w-0">
          <h3 id={`chart-title-${id}`} className="font-semibold leading-tight">{title}</h3>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {titleAction}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-controls={`chart-table-${id}`}
            aria-pressed={showTable}
            onClick={() => setShowTable((visible) => !visible)}
          >
            {showTable ? 'View chart' : 'View as table'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 px-4 pb-4 sm:px-6 sm:pb-6">
        <div hidden={showTable} aria-labelledby={`chart-title-${id}`}>
          {children}
        </div>
        <div id={`chart-table-${id}`} hidden={!showTable}>
          {table}
        </div>
      </CardContent>
    </Card>
  )
}

interface ChartTableProps {
  caption: string
  headers: string[]
  children: ReactNode
}

export function ChartTable({ caption, headers, children }: ChartTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border-subtle">
            {headers.map((header) => (
              <th key={header} scope="col" className="whitespace-nowrap px-2 py-2 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">{children}</tbody>
      </table>
    </div>
  )
}

export function ChartTableRow({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-2 py-3 text-text-muted">{children}</td></tr>
}