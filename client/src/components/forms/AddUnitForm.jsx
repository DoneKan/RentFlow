import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { createUnit } from '../../services/unit.service'
import { PAYMENT_PERIODS, UNIT_TYPES } from '../../utils/constants'

export default function AddUnitForm({ propertyId, onClose }) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    unitNumber: '',
    floor: '',
    type: '2-Bedroom',
    bedrooms: 2,
    bathrooms: 1,
    squareMeters: '',
    rentAmount: '',
    paymentPeriod: 'MONTHLY',
  })
  const [charges, setCharges] = useState([])
  const [chargeInput, setChargeInput] = useState({ name: '', amount: '' })

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const addCharge = () => {
    if (!chargeInput.name || !chargeInput.amount) return
    setCharges((p) => [...p, { ...chargeInput }])
    setChargeInput({ name: '', amount: '' })
  }

  const removeCharge = (i) => setCharges((p) => p.filter((_, idx) => idx !== i))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.unitNumber || !form.rentAmount) {
      toast.error('Unit number and rent amount are required')
      return
    }
    const additionalCharges = {}
    charges.forEach((c) => { additionalCharges[c.name] = parseFloat(c.amount) })

    setLoading(true)
    try {
      await createUnit(propertyId, {
        ...form,
        floor: form.floor ? parseInt(form.floor) : undefined,
        bedrooms: parseInt(form.bedrooms),
        bathrooms: parseInt(form.bathrooms),
        squareMeters: form.squareMeters ? parseFloat(form.squareMeters) : undefined,
        rentAmount: parseFloat(form.rentAmount),
        additionalCharges,
      })
      toast.success('Unit added successfully!')
      qc.invalidateQueries({ queryKey: ['property-units', propertyId] })
      qc.invalidateQueries({ queryKey: ['property', propertyId] })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add unit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Unit number *</label>
          <input value={form.unitNumber} onChange={(e) => set('unitNumber', e.target.value)} className="input" placeholder="1A" required />
        </div>
        <div>
          <label className="label">Floor</label>
          <input type="number" value={form.floor} onChange={(e) => set('floor', e.target.value)} className="input" placeholder="1" />
        </div>
      </div>

      <div>
        <label className="label">Unit type *</label>
        <select value={form.type} onChange={(e) => set('type', e.target.value)} className="input">
          {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Bedrooms</label>
          <input type="number" min="0" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Bathrooms</label>
          <input type="number" min="0" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Sq. meters</label>
          <input type="number" value={form.squareMeters} onChange={(e) => set('squareMeters', e.target.value)} className="input" placeholder="75" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Rent amount *</label>
          <input type="number" value={form.rentAmount} onChange={(e) => set('rentAmount', e.target.value)} className="input" placeholder="800000" required />
        </div>
        <div>
          <label className="label">Payment period</label>
          <select value={form.paymentPeriod} onChange={(e) => set('paymentPeriod', e.target.value)} className="input">
            {PAYMENT_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Additional charges */}
      <div>
        <label className="label">Additional charges</label>
        <div className="flex gap-2">
          <input
            value={chargeInput.name}
            onChange={(e) => setChargeInput((p) => ({ ...p, name: e.target.value }))}
            className="input flex-1"
            placeholder="e.g. Security"
          />
          <input
            type="number"
            value={chargeInput.amount}
            onChange={(e) => setChargeInput((p) => ({ ...p, amount: e.target.value }))}
            className="input w-28"
            placeholder="30000"
          />
          <button type="button" onClick={addCharge} className="btn-secondary px-3">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {charges.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {charges.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm">
                <span className="text-gray-700">{c.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-900 font-medium">{Number(c.amount).toLocaleString()}</span>
                  <button type="button" onClick={() => removeCharge(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'Adding…' : 'Add Unit'}
        </button>
      </div>
    </form>
  )
}
