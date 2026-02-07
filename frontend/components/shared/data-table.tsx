'use client'

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
}

export function DataTable<T>({ columns, data, className, onRowClick }: DataTableProps<T>) {
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
          {data.map((row, i) => (
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
    </div>
  )
}
