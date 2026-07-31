import api from './api'

export const listLeaseDocuments = (params) => api.get('/lease-documents', { params })
export const getLeaseDocument = (id) => api.get(`/lease-documents/${id}`)
export const createLeaseDocument = (tenancyId) => api.post('/lease-documents', { tenancyId })
export const signLeaseDocument = (id, data) => api.post(`/lease-documents/${id}/sign`, data)
export const voidLeaseDocument = (id) => api.post(`/lease-documents/${id}/void`)
export const downloadLeaseDocument = (id) =>
  api.get(`/lease-documents/${id}/download`, { responseType: 'blob' })
