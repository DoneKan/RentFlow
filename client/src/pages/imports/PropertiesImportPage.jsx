import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Download, Upload, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, Loader2,
} from 'lucide-react'
import { useValidateImport, useConfirmImport } from '../../hooks/useImports'
import { downloadImportTemplate, downloadImportErrorReport } from '../../services/import.service'
import { downloadBlob } from '../../utils/download'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'

const ENTITY_TYPE = 'properties'

function SummaryStat({ label, value, tone }) {
  const toneClasses = {
    neutral: 'text-gray-900',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${toneClasses[tone]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

export default function PropertiesImportPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [validation, setValidation] = useState(null) // { batchId, ignoredColumns, summary, preview, message? }
  const [includedWarningIds, setIncludedWarningIds] = useState(new Set())
  const [confirmResult, setConfirmResult] = useState(null) // { importedCount, skippedCount }
  const [confirmFailure, setConfirmFailure] = useState(null) // error message string
  const [templateDownloading, setTemplateDownloading] = useState(false)
  const [reportDownloading, setReportDownloading] = useState(false)

  const validateMutation = useValidateImport(ENTITY_TYPE)
  const confirmMutation = useConfirmImport(ENTITY_TYPE)

  const resetAll = () => {
    setFile(null)
    setValidation(null)
    setIncludedWarningIds(new Set())
    setConfirmResult(null)
    setConfirmFailure(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDownloadTemplate = async () => {
    setTemplateDownloading(true)
    try {
      const blob = await downloadImportTemplate(ENTITY_TYPE)
      downloadBlob(blob, 'rentflow-properties-template.csv')
    } catch {
      toast.error('Could not download the template')
    } finally {
      setTemplateDownloading(false)
    }
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    try {
      const res = await validateMutation.mutateAsync(file)
      setValidation(res.data)
      setIncludedWarningIds(new Set())
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not validate this file')
    }
  }

  const toggleWarning = (rowId) => {
    setIncludedWarningIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  const handleConfirm = async () => {
    if (!validation) return
    setConfirmFailure(null)
    try {
      const res = await confirmMutation.mutateAsync({
        batchId: validation.batchId,
        includeRowIds: Array.from(includedWarningIds),
      })
      setConfirmResult(res.data)
      toast.success(res.message)
    } catch (err) {
      setConfirmFailure(err.response?.data?.message || 'Import failed')
    }
  }

  const handleDownloadErrors = async () => {
    if (!validation) return
    setReportDownloading(true)
    try {
      const blob = await downloadImportErrorReport(ENTITY_TYPE, validation.batchId)
      downloadBlob(blob, 'rentflow-properties-import-errors.csv')
    } catch {
      toast.error('Could not download the error report')
    } finally {
      setReportDownloading(false)
    }
  }

  const rowColumns = (withReason, withCheckbox) => [
    { key: 'rowNumber', label: 'Row' },
    { key: 'name', label: 'Name', render: (_, row) => row.data.name || <span className="text-gray-300">—</span> },
    { key: 'type', label: 'Type', render: (_, row) => row.data.type || '—' },
    { key: 'city', label: 'City', render: (_, row) => row.data.city || '—' },
    { key: 'address', label: 'Address', render: (_, row) => row.data.address || '—' },
    ...(withReason
      ? [{ key: 'reasons', label: 'Reason', render: (_, row) => (
        <span className="text-sm">{row.reasons.join(' ')}</span>
      ) }]
      : []),
    ...(withCheckbox
      ? [{ key: 'include', label: 'Import anyway?', render: (_, row) => (
        <input
          type="checkbox"
          checked={includedWarningIds.has(row.id)}
          onChange={() => toggleWarning(row.id)}
          className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
        />
      ) }]
      : []),
  ]

  const showResult = confirmResult || confirmFailure
  const showPreview = validation && !showResult

  return (
    <div>
      <PageHeader
        title="Import Properties"
        subtitle="Upload a CSV to bulk-create properties"
        actions={[
          <button key="back" onClick={() => navigate('/properties')} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Properties
          </button>,
        ]}
      />

      {!validation && (
        <div className="card max-w-2xl">
          <div className="flex items-start gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 flex-shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">1. Get the template</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Download the CSV template, fill in your properties, and keep the column headers unchanged.
              </p>
            </div>
          </div>
          <button onClick={handleDownloadTemplate} disabled={templateDownloading} className="btn-secondary flex items-center gap-2 mb-8">
            {templateDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Template
          </button>

          <div className="flex items-start gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 flex-shrink-0">
              <Upload className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">2. Upload your file</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Nothing is saved yet — you'll see a preview of exactly what will be imported first.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:text-sm file:font-medium hover:file:bg-gray-200"
            />
          </div>
          {file && (
            <button
              onClick={handleUpload}
              disabled={validateMutation.isPending}
              className="btn-primary flex items-center gap-2 mt-4"
            >
              {validateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {validateMutation.isPending ? 'Validating…' : 'Upload & Preview'}
            </button>
          )}
        </div>
      )}

      {showPreview && (
        <div>
          {validation.ignoredColumns.length > 0 && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700">
              These columns weren't recognized and were ignored: {validation.ignoredColumns.join(', ')}
            </div>
          )}

          {validation.summary.total === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">{validation.message}</p>
              <button onClick={resetAll} className="btn-secondary mt-4">Choose a different file</button>
            </div>
          ) : (
            <>
              <div className="card mb-6">
                <div className="grid grid-cols-4 divide-x divide-gray-100">
                  <SummaryStat label="Total rows" value={validation.summary.total} tone="neutral" />
                  <SummaryStat label="Will import cleanly" value={validation.summary.clean} tone="green" />
                  <SummaryStat label="Warnings" value={validation.summary.warnings} tone="amber" />
                  <SummaryStat label="Hard errors" value={validation.summary.errors} tone="red" />
                </div>
              </div>

              {validation.preview.clean.length > 0 && (
                <div className="mb-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Will import cleanly ({validation.preview.clean.length})
                  </h3>
                  <DataTable columns={rowColumns(false, false)} data={validation.preview.clean} />
                </div>
              )}

              {validation.preview.warnings.length > 0 && (
                <div className="mb-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Warnings ({validation.preview.warnings.length}) — excluded by default
                  </h3>
                  <DataTable columns={rowColumns(true, true)} data={validation.preview.warnings} />
                </div>
              )}

              {validation.preview.errors.length > 0 && (
                <div className="mb-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Hard errors ({validation.preview.errors.length}) — cannot be imported
                  </h3>
                  <DataTable columns={rowColumns(true, false)} data={validation.preview.errors} />
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={confirmMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {confirmMutation.isPending ? 'Importing…' : 'Confirm Import'}
                </button>
                <button onClick={resetAll} className="btn-secondary">Cancel</button>
                {(validation.summary.warnings > 0 || validation.summary.errors > 0) && (
                  <button
                    onClick={handleDownloadErrors}
                    disabled={reportDownloading}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 ml-auto"
                  >
                    {reportDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Download skipped-rows report
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {showResult && (
        <div className="card max-w-xl text-center py-10">
          {confirmResult ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">
                {confirmResult.importedCount} propert{confirmResult.importedCount !== 1 ? 'ies' : 'y'} imported
              </h3>
              {confirmResult.skippedCount > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {confirmResult.skippedCount} row{confirmResult.skippedCount !== 1 ? 's' : ''} skipped — download the report below to fix and re-upload.
                </p>
              )}
            </>
          ) : (
            <>
              <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">Import failed</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{confirmFailure}</p>
            </>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={handleDownloadErrors}
              disabled={reportDownloading}
              className="btn-secondary flex items-center gap-2"
            >
              {reportDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Report
            </button>
            <button onClick={resetAll} className="btn-secondary">Import Another File</button>
            <button onClick={() => navigate('/properties')} className="btn-primary">Go to Properties</button>
          </div>
        </div>
      )}
    </div>
  )
}
