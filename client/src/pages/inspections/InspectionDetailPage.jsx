import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Camera, FileText, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useInspection, useAddInspectionItem, useUpdateInspectionItem, useUploadItemPhotos,
  useCompleteInspection, openInspectionReport,
} from '../../hooks/useInspections'
import { formatDate, getUploadUrl } from '../../utils/formatters'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const CONDITIONS = ['GOOD', 'FAIR', 'POOR', 'DAMAGED']
const CONDITION_COLORS = {
  GOOD: 'bg-green-100 text-green-700',
  FAIR: 'bg-yellow-100 text-yellow-700',
  POOR: 'bg-orange-100 text-orange-700',
  DAMAGED: 'bg-red-100 text-red-700',
}

function AddItemForm({ inspectionId }) {
  const add = useAddInspectionItem()
  const [form, setForm] = useState({ area: '', condition: 'GOOD', notes: '' })
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.area) return toast.error('Please enter an area name')
    try {
      await add.mutateAsync({ id: inspectionId, data: form })
      setForm({ area: '', condition: 'GOOD', notes: '' })
    } catch {
      toast.error('Failed to add checklist item')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[160px]">
        <label className="text-xs text-gray-500 block mb-1">Area</label>
        <input value={form.area} onChange={(e) => set('area', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Kitchen, Bathroom" />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Condition</label>
        <select value={form.condition} onChange={(e) => set('condition', e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="text-xs text-gray-500 block mb-1">Notes</label>
        <input value={form.notes} onChange={(e) => set('notes', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
      </div>
      <button type="submit" disabled={add.isPending} className="flex items-center gap-1.5 bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand/90 disabled:opacity-50">
        <Plus className="h-4 w-4" /> Add
      </button>
    </form>
  )
}

function ChecklistItem({ inspectionId, item, readOnly }) {
  const updateItem = useUpdateInspectionItem()
  const uploadPhotos = useUploadItemPhotos()

  const handleCondition = async (condition) => {
    try {
      await updateItem.mutateAsync({ id: inspectionId, itemId: item.id, data: { condition } })
    } catch {
      toast.error('Failed to update condition')
    }
  }

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    try {
      await uploadPhotos.mutateAsync({ id: inspectionId, itemId: item.id, files })
      toast.success('Photos uploaded')
    } catch {
      toast.error('Failed to upload photos')
    }
    e.target.value = ''
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900 text-sm">{item.area}</p>
          {item.notes && <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>}
        </div>
        {readOnly ? (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CONDITION_COLORS[item.condition]}`}>{item.condition}</span>
        ) : (
          <div className="flex gap-1.5">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                onClick={() => handleCondition(c)}
                disabled={updateItem.isPending}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                  item.condition === c ? CONDITION_COLORS[c] + ' border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {item.photos?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {item.photos.map((p) => (
            <a key={p.id} href={getUploadUrl(p.url)} target="_blank" rel="noreferrer">
              <img src={getUploadUrl(p.url)} alt="" className="h-16 w-16 object-cover rounded-lg border border-gray-100" />
            </a>
          ))}
        </div>
      )}

      {!readOnly && (
        <label className="flex items-center gap-1.5 text-xs text-brand hover:underline mt-3 cursor-pointer w-fit">
          <Camera className="h-3.5 w-3.5" /> Add photos
          <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFiles} />
        </label>
      )}
    </div>
  )
}

export default function InspectionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: inspection, isLoading } = useInspection(id)
  const complete = useCompleteInspection()

  if (isLoading) return <LoadingSpinner fullPage />
  if (!inspection) return null

  const readOnly = inspection.status !== 'SCHEDULED'

  const handleComplete = async () => {
    try {
      await complete.mutateAsync({ id, data: {} })
      toast.success('Inspection marked complete')
    } catch {
      toast.error('Failed to complete inspection')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/inspections')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{inspection.type.replace('_', ' ')} Inspection</h1>
          <p className="text-sm text-gray-500">{inspection.property?.name}{inspection.scheduledDate ? ` · Scheduled ${formatDate(inspection.scheduledDate)}` : ''}</p>
        </div>
        <StatusBadge status={inspection.status} />
        <button onClick={() => openInspectionReport(id)} className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">
          <FileText className="h-4 w-4" /> Report
        </button>
        {!readOnly && (
          <button onClick={handleComplete} disabled={complete.isPending} className="btn-primary">
            {complete.isPending ? 'Saving…' : 'Mark Complete'}
          </button>
        )}
      </div>

      {!readOnly && <AddItemForm inspectionId={id} />}

      <div className="space-y-3">
        {inspection.items?.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">No checklist items yet. Add one above.</p>
        )}
        {inspection.items?.map((item) => (
          <ChecklistItem key={item.id} inspectionId={id} item={item} readOnly={readOnly} />
        ))}
      </div>
    </div>
  )
}
