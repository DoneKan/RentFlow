import api from './api'

export const getMyOwnerPortal = () => api.get('/owner/portal/me')
export const getOwnerPropertyStatement = (propertyId, params) =>
  api.get(`/owner/portal/properties/${propertyId}/statement`, { params })
