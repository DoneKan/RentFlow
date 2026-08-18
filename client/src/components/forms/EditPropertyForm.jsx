import { useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUpdateProperty } from '../../hooks/useProperties'
import { PROPERTY_TYPES } from '../../utils/constants'

export default function EditPropertyForm({ property, onClose }) {
  const update = useUpdateProperty()
  const [form, setForm] = useState({
    name: property.name || '',
    type: property.type || 'RESIDENTIAL',
    description: property.description || '',
    address: property.address || '',
    city: property.city || '',
    district: property.district || '',
    country: property.country || 'UG',
    latitude: property.latitude ?? '',
    longitude: property.longitude ?? '',
    amenities: property.amenities || [],
  })
  const [amenityInput, setAmenityInput] = useState('')

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }))

  const addAmenity = (e) => {
    if (e.key === 'Enter' && amenityInput.trim()) {
      e.preventDefault()
      if (!form.amenities.includes(amenityInput.trim())) {
        set('amenities', [...form.amenities, amenityInput.trim()])
      }
      setAmenityInput('')
    }
  }

  const removeAmenity = (a) => set('amenities', form.amenities.filter((x) => x !== a))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.address || !form.city) {
      toast.error('Please fill in all required fields')
      return
    }
    try {
      await update.mutateAsync({
        id: property.id,
        data: {
          ...form,
          latitude: form.latitude !== '' ? parseFloat(form.latitude) : null,
          longitude: form.longitude !== '' ? parseFloat(form.longitude) : null,
        },
      })
      toast.success('Property updated successfully!')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update property')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Property name *</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="Nakasero Heights" required />
      </div>

      <div>
        <label className="label">Property type *</label>
        <select value={form.type} onChange={(e) => set('type', e.target.value)} className="input">
          {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="input h-20 resize-none" placeholder="Brief description of the property…" />
      </div>

      <div>
        <label className="label">Street address *</label>
        <input value={form.address} onChange={(e) => set('address', e.target.value)} className="input" placeholder="Plot 12, Nakasero Road" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">City *</label>
          <input value={form.city} onChange={(e) => set('city', e.target.value)} className="input" placeholder="Kampala" required />
        </div>
        <div>
          <label className="label">District</label>
          <input value={form.district} onChange={(e) => set('district', e.target.value)} className="input" placeholder="Kampala" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Latitude <span className="text-gray-400 text-xs">(optional)</span></label>
          <input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} className="input" placeholder="0.3476" />
        </div>
        <div>
          <label className="label">Longitude <span className="text-gray-400 text-xs">(optional)</span></label>
          <input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} className="input" placeholder="32.5825" />
        </div>
      </div>
      <p className="text-xs text-gray-400 -mt-2">Get coordinates from Google Maps by right-clicking a location.</p>

      <div>
        <label className="label">Amenities</label>
        <input
          value={amenityInput}
          onChange={(e) => setAmenityInput(e.target.value)}
          onKeyDown={addAmenity}
          className="input"
          placeholder="Type amenity and press Enter (e.g. Swimming Pool, Parking)"
        />
        {form.amenities.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {form.amenities.map((a) => (
              <span key={a} className="flex items-center gap-1 bg-brand/10 text-brand text-xs px-2.5 py-1 rounded-full">
                {a}
                <button type="button" onClick={() => removeAmenity(a)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={update.isPending} className="btn-primary flex-1">
          {update.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
