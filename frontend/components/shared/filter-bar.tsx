'use client'

import { useGlobalStore } from '@/lib/store/global-store'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar, Building2, Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  showDepartment?: boolean
  showDateRange?: boolean
  showRiskLevel?: boolean
  className?: string
}

export function FilterBar({ showDepartment = true, showDateRange = true, showRiskLevel = false, className }: FilterBarProps) {
  const { department, setDepartment, dateRange } = useGlobalStore()

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Filter className="w-3.5 h-3.5" />
        <span>Filters:</span>
      </div>

      {showDepartment && (
        <Select value={department || 'all'} onValueChange={(v) => setDepartment(v === 'all' ? null : v)}>
          <SelectTrigger className="h-7 text-xs border-[#e8e8ef] bg-gray-50 text-gray-600 hover:bg-gray-100 w-auto gap-1">
            <Building2 className="w-3 h-3" />
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="Engineering">Engineering</SelectItem>
            <SelectItem value="Sales">Sales</SelectItem>
            <SelectItem value="Marketing">Marketing</SelectItem>
            <SelectItem value="Product">Product</SelectItem>
            <SelectItem value="Customer Success">Customer Success</SelectItem>
            <SelectItem value="Finance">Finance</SelectItem>
          </SelectContent>
        </Select>
      )}

      {showDateRange && (
        <Button variant="outline" size="sm" className="h-7 text-xs border-[#e8e8ef] bg-gray-50 text-gray-600 hover:bg-gray-100 gap-1">
          <Calendar className="w-3 h-3" />
          Last 30 days
        </Button>
      )}

      {showRiskLevel && (
        <Select>
          <SelectTrigger className="h-7 text-xs border-[#e8e8ef] bg-gray-50 text-gray-600 hover:bg-gray-100 w-auto">
            <SelectValue placeholder="All Risk Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="high">High Risk</SelectItem>
            <SelectItem value="medium">Medium Risk</SelectItem>
            <SelectItem value="low">Low Risk</SelectItem>
          </SelectContent>
        </Select>
      )}

      {department && (
        <button
          onClick={() => setDepartment(null)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 bg-gray-50 border border-[#e8e8ef] rounded px-2 py-0.5"
        >
          {department} <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
