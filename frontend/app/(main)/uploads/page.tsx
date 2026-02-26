'use client'

import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, DollarSign, Building2, TrendingDown, BarChart3, Upload, Download, CheckCircle2, AlertCircle, Clock, Loader2, Scale, MessageSquare, PhoneCall, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUploads, useUploadFile, useUploadStatus } from '@/lib/api/hooks'
import { useAuth } from '@/lib/auth/store'
import type { ApiUploadedFile } from '@/lib/api/types'

type UploadStep = 'idle' | 'confirming' | 'processing' | 'complete' | 'error'
type TemplateType = 'employees' | 'compensation' | 'compensation_bands' | 'customers' | 'churn_signals' | 'survey_responses' | 'csm_notes' | 'kpis'

type UploadTemplate = {
  id: TemplateType
  icon: React.ElementType
  name: string
  description: string
  columns: number
  color: string
  ai?: boolean
}

const TEMPLATE_SCHEMAS: Record<TemplateType, { columns: string[]; sample: (string | number)[] }> = {
  employees: {
    columns: ['name', 'email', 'department', 'role', 'level', 'location', 'hire_date', 'skills', 'status'],
    sample: ['Alice Johnson', 'alice@acme.com', 'Engineering', 'Senior Engineer', 'L5', 'San Francisco', '2022-03-15', 'python,react', 'active'],
  },
  compensation: {
    columns: ['employee_email', 'salary', 'bonus', 'equity', 'last_review_date', 'currency', 'effective_date'],
    sample: ['alice@acme.com', 185000, 25000, 50000, '2024-12-01', 'USD', '2025-01-01'],
  },
  compensation_bands: {
    columns: ['role', 'level', 'location', 'market_min', 'market_mid', 'market_max'],
    sample: ['Senior Engineer', 'L5', 'San Francisco', 170000, 195000, 220000],
  },
  customers: {
    columns: ['name', 'segment', 'tier', 'arr', 'renewal_date', 'contract_start', 'status'],
    sample: ['Acme Corp', 'enterprise', 'gold', 250000, '2026-09-30', '2024-10-01', 'active'],
  },
  churn_signals: {
    columns: ['customer_name', 'signal_type', 'value', 'recorded_at'],
    sample: ['Acme Corp', 'usage', '0.35', '2025-04-15'],
  },
  kpis: {
    columns: ['name', 'category', 'value', 'target', 'unit', 'period'],
    sample: ['Monthly Recurring Revenue', 'finance', 342000, 364000, 'USD', '2025-04'],
  },
  survey_responses: {
    columns: ['employee_email', 'response_text'],
    sample: ['alice@acme.com', 'I feel my workload has been unsustainable lately, and I am worried about burning out.'],
  },
  csm_notes: {
    columns: ['customer_name', 'note_type', 'meeting_date', 'notes'],
    sample: ['Acme Corp', 'call', '2025-04-15', 'Customer expressed concerns about pricing renewal. Champion is leaving the company next month.'],
  },
}

function downloadCsvTemplate(type: TemplateType) {
  const schema = TEMPLATE_SCHEMAS[type]
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [
    schema.columns.join(','),
    schema.sample.map(escape).join(','),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${type}_template.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const uploadTemplates: UploadTemplate[] = [
  { id: 'employees', icon: Users, name: 'Employees', description: 'Employee roster and headcount data', columns: TEMPLATE_SCHEMAS.employees.columns.length, color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { id: 'compensation', icon: DollarSign, name: 'Compensation', description: 'Salary, bonus, equity per employee', columns: TEMPLATE_SCHEMAS.compensation.columns.length, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { id: 'compensation_bands', icon: Scale, name: 'Compensation Bands', description: 'Market salary ranges by role/level/location', columns: TEMPLATE_SCHEMAS.compensation_bands.columns.length, color: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' },
  { id: 'customers', icon: Building2, name: 'Customers', description: 'Customer accounts and contracts', columns: TEMPLATE_SCHEMAS.customers.columns.length, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { id: 'churn_signals', icon: TrendingDown, name: 'Churn Signals', description: 'Customer health and churn indicators', columns: TEMPLATE_SCHEMAS.churn_signals.columns.length, color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  { id: 'kpis', icon: BarChart3, name: 'KPIs', description: 'Key performance indicators and metrics', columns: TEMPLATE_SCHEMAS.kpis.columns.length, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { id: 'survey_responses', icon: MessageSquare, name: 'Survey Responses', description: 'Free-text employee survey responses (AI-analyzed)', columns: TEMPLATE_SCHEMAS.survey_responses.columns.length, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', ai: true },
  { id: 'csm_notes', icon: PhoneCall, name: 'CSM Notes', description: 'Customer call/meeting notes (AI-analyzed)', columns: TEMPLATE_SCHEMAS.csm_notes.columns.length, color: 'bg-teal-500/10 text-teal-400 border-teal-500/20', ai: true },
]

const statusConfig = {
  complete: { icon: CheckCircle2, color: 'text-green-600', badge: 'bg-green-50 text-green-700 border-green-200', label: 'Success' },
  error: { icon: AlertCircle, color: 'text-red-600', badge: 'bg-red-50 text-red-600 border-red-200', label: 'Error' },
  pending: { icon: Clock, color: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pending' },
  validating: { icon: Clock, color: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Validating' },
  processing: { icon: Clock, color: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Processing' },
}

function formatUploadTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  )
}

export default function UploadsPage() {
  const [dragging, setDragging] = useState(false)
  const [step, setStep] = useState<UploadStep>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [templateType, setTemplateType] = useState<TemplateType>('employees')
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const auth = useAuth()
  const orgId = auth?.orgId ?? ''

  const { data: uploads = [], isLoading: uploadsLoading } = useUploads()
  const { mutate: uploadFile, isPending: isUploading } = useUploadFile()
  const { data: uploadStatus } = useUploadStatus(step === 'processing' ? uploadedFileId : null)

  useEffect(() => {
    if (step !== 'processing' || !uploadStatus) return
    if (uploadStatus.status === 'complete') {
      setStep('complete')
      queryClient.invalidateQueries({ queryKey: ['uploads', orgId] })
    } else if (uploadStatus.status === 'error') {
      setStep('error')
    }
  }, [step, uploadStatus, queryClient])

  const handleFileCapture = (file: File) => {
    setSelectedFile(file)
    setStep('confirming')
  }

  const handleConfirm = () => {
    if (!selectedFile) return
    uploadFile(
      { file: selectedFile, templateType },
      {
        onSuccess: (data) => {
          setUploadedFileId(data.id)
          setStep('processing')
        },
        onError: () => setStep('error'),
      }
    )
  }

  const handleReset = () => {
    setStep('idle')
    setSelectedFile(null)
    setUploadedFileId(null)
  }

  const handleTemplateDownload = (template: UploadTemplate) => {
    downloadCsvTemplate(template.id)
    setToastMessage(`${template.name} template downloaded`)
    setTimeout(() => setToastMessage(null), 2000)
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title="Data Uploads"
        description="Upload CSV or Excel files to populate your workspace"
      />

      {step === 'idle' && (
        <>
          {/* Template Type Selector */}
          <div className="mb-3 flex items-center gap-3">
            <span className="text-xs text-gray-500 shrink-0">Template type:</span>
            <select
              value={templateType}
              onChange={e => setTemplateType(e.target.value as TemplateType)}
              className="text-xs border border-[#e8e8ef] rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <optgroup label="Structured">
                {uploadTemplates.filter(t => !t.ai).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
              <optgroup label="AI-Analyzed (unstructured)">
                {uploadTemplates.filter(t => t.ai).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            </select>
            {uploadTemplates.find(t => t.id === templateType)?.ai && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <Sparkles className="w-2.5 h-2.5" /> AI extracts signals + triggers re-scoring
              </span>
            )}
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) handleFileCapture(file)
            }}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center transition-colors mb-8',
              dragging ? 'border-indigo-400 bg-indigo-50' : 'border-[#e8e8ef] hover:border-indigo-300'
            )}
          >
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-1">Drop CSV or Excel files here</p>
            <p className="text-xs text-gray-400 mb-4">or</p>
            <Button
              size="sm"
              className="bg-indigo-500 hover:bg-indigo-600 text-xs h-7"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFileCapture(file)
                e.target.value = ''
              }}
            />
          </div>

          {/* Template Downloads */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Download Templates</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {uploadTemplates.map(template => {
                const Icon = template.icon
                return (
                  <div key={template.id} className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-3 flex flex-col gap-2 relative">
                    {template.ai && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                        <Sparkles className="w-2 h-2" /> AI
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <div className={cn('w-6 h-6 rounded-lg border flex items-center justify-center', template.color)}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-800">{template.name}</p>
                        <p className="text-[10px] text-gray-400">{template.columns} columns</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 line-clamp-2">{template.description}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] border-[#e8e8ef] text-gray-600 hover:text-gray-800 gap-1"
                      onClick={() => handleTemplateDownload(template)}
                    >
                      <Download className="w-2.5 h-2.5" /> Download
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Upload History */}
          <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e8e8ef]">
              <h3 className="text-sm font-medium text-gray-900">Upload History</h3>
            </div>
            {uploadsLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : uploads.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">No uploads yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e8e8ef]">
                      {['File', 'Type', 'Rows', 'Status', 'Uploaded'].map(h => (
                        <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map((upload: ApiUploadedFile) => {
                      const statusKey = (upload.status in statusConfig ? upload.status : 'pending') as keyof typeof statusConfig
                      const sc = statusConfig[statusKey]
                      const StatusIcon = sc.icon
                      return (
                        <tr key={upload.id} className="border-b border-[#e8e8ef] hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 text-xs font-medium text-gray-800">{upload.original_filename}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 capitalize">{upload.template_type.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">
                            {upload.row_count != null && upload.row_count > 0 ? upload.row_count.toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <StatusIcon className={cn('w-3 h-3', sc.color)} />
                              <Badge className={cn('text-[10px]', sc.badge)}>{sc.label}</Badge>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{formatUploadTime(upload.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirm Step */}
      {step === 'confirming' && selectedFile && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
            <p className="text-sm font-medium text-gray-900 mb-1">{selectedFile.name}</p>
            <p className="text-xs text-gray-500 mb-3">
              {(selectedFile.size / 1024).toFixed(1)} KB · Template:{' '}
              <span className="capitalize font-medium">{templateType.replace(/_/g, ' ')}</span>
            </p>
            <p className="text-xs text-gray-500">
              Rows will be validated against the{' '}
              <span className="capitalize font-medium">{templateType.replace(/_/g, ' ')}</span> schema and inserted into the database.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="border-[#e8e8ef] text-gray-600" onClick={handleReset}>
              Back
            </Button>
            <Button className="bg-indigo-500 hover:bg-indigo-600" onClick={handleConfirm} disabled={isUploading}>
              {isUploading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Uploading…</>
              ) : (
                'Confirm Upload'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Processing Step */}
      {step === 'processing' && (
        <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-6 max-w-md mx-auto text-center">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">Processing Upload</p>
          <p className="text-xs text-gray-500">
            {uploadStatus?.status === 'pending'
              ? 'Queued for processing…'
              : uploadStatus?.status === 'validating'
              ? 'Validating columns…'
              : 'Parsing and inserting rows…'}
          </p>
        </div>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-6 max-w-md mx-auto text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">Upload Complete</h3>
          <div className="text-xs text-gray-600 mb-4 space-y-0.5">
            {uploadStatus?.row_count != null && <p>{uploadStatus.row_count} rows processed</p>}
            <p className="text-gray-400">{selectedFile?.name}</p>
          </div>
          <Button className="w-full bg-indigo-500 hover:bg-indigo-600 text-xs h-7" onClick={handleReset}>
            Upload Another
          </Button>
        </div>
      )}

      {/* Error Step */}
      {step === 'error' && (
        <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-6 max-w-md mx-auto text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">Upload Failed</h3>
          <p className="text-xs text-gray-500 mb-4">
            {uploadStatus?.error_message ?? 'An error occurred while processing the file.'}
          </p>
          <Button className="w-full bg-indigo-500 hover:bg-indigo-600 text-xs h-7" onClick={handleReset}>
            Try Again
          </Button>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 left-4 bg-gray-900 text-white px-4 py-2 rounded-lg text-xs">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
