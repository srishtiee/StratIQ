'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Column<T> {
  key: string
  header: string
  cell: (row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  className?: string
  onRowClick?: (row: T) => void
  /**
   * If set, the table renders only this many rows initially and shows a
   * "See more (N)" toggle in the footer. When expanded, all rows are shown.
   */
  collapsedRows?: number
}

export function DataTable<T>({ columns, data, className, onRowClick, collapsedRows }: DataTableProps<T>) {
  const [expanded, setExpanded] = useState(false)
  const collapsible = collapsedRows != null && data.length > collapsedRows
  const visible = collapsible && !expanded ? data.slice(0, collapsedRows!) : data
  const hiddenCount = collapsible ? data.length - collapsedRows! : 0

  return (
    <div className={cn('rounded-lg border border-[#e8e8ef] overflow-hidden bg-white', className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-[#e8e8ef] hover:bg-transparent">
            {columns.map(col => (
              <TableHead key={col.key} className={cn('text-xs text-gray-500 font-medium h-9 bg-gray-50 uppercase tracking-wide', col.className)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row, i) => (
            <TableRow
              key={i}
              className={cn('border-[#e8e8ef] transition-colors', onRowClick ? 'cursor-pointer hover:bg-gray-50' : 'hover:bg-gray-50')}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(col => (
                <TableCell key={col.key} className={cn('py-2.5 text-sm', col.className)}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {collapsible && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium py-2 border-t border-[#e8e8ef] hover:bg-indigo-50/50 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" /> See more ({hiddenCount})
            </>
          )}
        </button>
      )}
    </div>
  )
}
