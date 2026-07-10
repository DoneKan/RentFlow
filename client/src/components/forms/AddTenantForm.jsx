import { useState } from 'react'
import { Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { useCreateTenant } from '../../hooks/useTenants'
import { getProperties } from '../../services/property.service'
import { getPropertyUnits } from '../../services/property.service'
import { PAYMENT_PERIODS } from '../../utils/constants'
import { formatCurrency } from '../../utils/formatters'

const STEPS = ['Personal Info', 'Unit Assignment', 'Tenancy Terms']

export default function AddTenantForm({ onClose, defaultPropertyId }) {
  const create = useCreateTenant()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    propertyId: defaultPropertyId || '',
    unitId: '',
    startDate: new Date().toISOString().split('T')[0],
    rentAmount: '',
    depositAmount: '',
    paymentPeriod: 'MONTHLY',
    notes: '',
  })

  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
    select: (r) => r.data?.data || [],
  })

  const { data: unitsData } = useQuery({
    queryKey: ['property-units-vacant', form.propertyId],
    queryFn: () => getPropertyUnits(form.propertyId),
    select: (r) => (r.data?.units || []).filter((u) => u.status === 'VACANT'),
    enabled: !!form.propertyId,
  })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleUnitSelect = (unit) => {
    set('unitId', unit.id)
    set('rentAmount', unit.rentAmount)
    set('paymentPeriod', unit.paymentPeriod)
  }

  const validateStep = () => {
    if (step === 0) {
      if (!form.name || !form.email) { toast.error('Name and email are required'); return false }
    } else if (step === 1) {
      if (!form.propertyId || !form.unitId) { toast.error('Please select a property and unit'); return false }
    } else if (step === 2) {
      if (!form.startDate || !form.rentAmount) { toast.error('Start date and rent amount are required'); return false }
    }
    return true
  }

  const next = () => { if (validateStep()) setStep((s) => s + 1) }
  const back = () => setStep((s) => s - 1)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep()) return
    try {
      await create.mutateAsync({
        ...form,
        rentAmount: parseFloat(form.rentAmount),
        depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : 0,
      })
      toast.success('Tenant added successfully!')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add tenant')
    }
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
              i < step ? 'bg-green-500 text-white' : i === step ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden sm:block ml-2 text-xs ${i === step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-3 ${i < step ? 'bg-green-500' : 'bg-gray-100'}`} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="label">Full name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="Jane Nakato" required />
            </div>
            <div>
              <label className="label">Email address *</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" placeholder="jane@email.com" required />
            </div>
            <div>
              <label className="label">Phone number</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" placeholder="+256 700 000 000" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">Property *</label>
              <select value={form.propertyId} onChange={(e) => { set('propertyId', e.target.value); set('unitId', '') }} className="input">
                <option value="">Select property…</option>
                {(propertiesData || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {form.propertyId && (
              <div>
                <label className="label">Available unit *</label>
                {!unitsData?.length ? (
                  <p className="text-sm text-gray-400 py-2">No vacant units in this property</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {unitsData.map((unit) => (
                      <label
                        key={unit.id}
                        className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          form.unitId === unit.id ? 'border-brand bg-brand/5' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div>
                          <input type="radio" name="unit" className="sr-only" checked={form.unitId === unit.id} onChange={() => handleUnitSelect(unit)} />
                          <p className="text-sm font-medium text-gray-900">Unit {unit.unitNumber}</p>
                          <p className="text-xs text-gray-500">{unit.type} · Floor {unit.floor ?? 'G'}</p>
                        </div>
                        <p className="text-sm font-semibold text-brand">{formatCurrency(unit.rentAmount)}</p>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Move-in date *</label>
                <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Payment period</label>
                <select value={form.paymentPeriod} onChange={(e) => set('paymentPeriod', e.target.value)} className="input">
                  {PAYMENT_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Rent amount (UGX) *</label>
                <input type="number" value={form.rentAmount} onChange={(e) => set('rentAmount', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Deposit (UGX)</label>
                <input type="number" value={form.depositAmount} onChange={(e) => set('depositAmount', e.target.value)} className="input" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="input h-16 resize-none" placeholder="Any special terms or notes…" />
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          {step > 0 && <button type="button" onClick={back} className="btn-secondary flex-1">Back</button>}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="btn-primary flex-1">Next</button>
          ) : (
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
              {create.isPending ? 'Adding…' : 'Add Tenant'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
