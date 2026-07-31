import api from './api'

export const listVendors = (params) => api.get('/vendors', { params })
export const getVendor = (id) => api.get(`/vendors/${id}`)
export const getVendorHistory = (id) => api.get(`/vendors/${id}/history`)
export const createVendor = (data) => api.post('/vendors', data)
export const updateVendor = (id, data) => api.put(`/vendors/${id}`, data)
export const deleteVendor = (id) => api.delete(`/vendors/${id}`)
