import api from './api'

export const getUnits = (params) =>
  api.get('/units', { params }).then((r) => r.data)

export const getUnit = (id) =>
  api.get(`/units/${id}`).then((r) => r.data)

export const createUnit = (propertyId, data) =>
  api.post(`/properties/${propertyId}/units`, data).then((r) => r.data)

export const updateUnit = (id, data) =>
  api.put(`/units/${id}`, data).then((r) => r.data)

export const deleteUnit = (id) =>
  api.delete(`/units/${id}`).then((r) => r.data)
