import { useState } from 'react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { useCreateLandlordExpenseReminder, useUpdateLandlordExpenseReminder } from '../../hooks/useLandlordExpenseReminders'
import { getProperties } from '../../services/property.service'
import { RECURRENCE_TYPES } from '../../utils/constants'
import NumberInput from '../ui/NumberInput'

export default function LandlordExpenseReminderForm({ reminder, onClose }) {
  const isEditing = !!reminder
  const create = useCreateLandlordExpenseReminder()
  const update = useUpdateLandlordExpenseReminder()
  const saving = isEditing ? update.isPending : create.isPending

  const [form, setForm] = useState({
    propertyId: reminder?.propertyId || '',
    name: reminder?.name || '',
    description: reminder?.description || '',
    amount: reminder?.amount || '',
    recurrenceType: reminder?.recurrenceType || 'ANNUAL',
    customIntervalDays: reminder?.customIntervalDays || '',
    nextDueDate: reminder?.nextDueDate ? reminder.nextDueDate.split('T')[0] : '',
    remindDaysBefore: reminder?.remindDaysBefore ?? 7,
  })

  const { data: propertiesData } = useQuery({
    queryKey: ['properties', 'all'],
    queryFn: () => getProperties({ limit: 200 }),
    select: (r) => r.data || [],
  })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.amount || !form.nextDueDate) {
      toast.error('Name, amount, and next due date are required')
      return
    }
    if (form.recurrenceType === 'CUSTOM' && !form.customIntervalDays) {
      toast.error('Enter the custom interval in days')
      return
    }

    const payload = {
      propertyId: form.propertyId || null,
      name: form.name,
      description: form.description,
      amount: parseFloat(form.amount),
      recurrenceType: form.recurrenceType,
      customIntervalDays: form.recurrenceType === 'CUSTOM' ? parseInt(form.customIntervalDays) : null,
      nextDueDate: form.nextDueDate,
      remindDaysBefore: parseInt(form.remindDaysBefore) || 0,
    }

    try {
      if (isEditing) {
        await update.mutateAsync({ id: reminder.id, data: payload })
        toast.success('Reminder updated')
      } else {
        await create.mutateAsync(payload)
        toast.success('Reminder created')
      }
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save reminder')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Name *</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="URA Rental Tax" required />
      </div>

      <div>
        <label className="label">Description <span className="text-gray-400 text-xs">(optional)</span></label>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="input h-16 resize-none" placeholder="Any notes about this cost…" />
      </div>

      <div>
        <label className="label">Property <span className="text-gray-400 text-xs">(optional — leave blank for a whole-business cost)</span></label>
        <select value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} className="input">
          <option value="">Whole business (not property-specific)</option>
          {(propertiesData || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount *</label>
          <NumberInput value={form.amount} onChange={(v) => set('amount', v)} required />
        </div>
        <div>
          <label className="label">Recurrence *</label>
          <select value={form.recurrenceType} onChange={(e) => set('recurrenceType', e.target.value)} className="input">
            {RECURRENCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {form.recurrenceType === 'CUSTOM' && (
        <div>
          <label className="label">Repeat every (days) *</label>
          <input type="number" min="1" value={form.customIntervalDays} onChange={(e) => set('customIntervalDays', e.target.value)} className="input" placeholder="90" required />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Next due date *</label>
          <input type="date" value={form.nextDueDate} onChange={(e) => set('nextDueDate', e.target.value)} className="input" required />
        </div>
        <div>
          <label className="label">Remind this many days before</label>
          <input type="number" min="0" max="90" value={form.remindDaysBefore} onChange={(e) => set('remindDaysBefore', e.target.value)} className="input" />
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Reminder'}
        </button>
      </div>
    </form>
  )
}
