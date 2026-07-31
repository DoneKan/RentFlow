import api from './api'

export const listInspections = (params) => api.get('/inspections', { params })
export const getInspection = (id) => api.get(`/inspections/${id}`)
export const createInspection = (data) => api.post('/inspections', data)
export const updateInspection = (id, data) => api.put(`/inspections/${id}`, data)
export const completeInspection = (id, data) => api.patch(`/inspections/${id}/complete`, data)
export const deleteInspection = (id) => api.delete(`/inspections/${id}`)
export const addInspectionItem = (id, data) => api.post(`/inspections/${id}/items`, data)
export const updateInspectionItem = (id, itemId, data) => api.put(`/inspections/${id}/items/${itemId}`, data)
export const uploadItemPhotos = (id, itemId, files) => {
  const fd = new FormData()
  files.forEach((f) => fd.append('photos', f))
  return api.post(`/inspections/${id}/items/${itemId}/photos`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const downloadInspectionReport = (id) =>
  api.get(`/inspections/${id}/report`, { responseType: 'blob' })
