import api from './api'

export const listProspects = (params) => api.get('/prospects', { params })
export const getProspect = (id) => api.get(`/prospects/${id}`)
export const createProspect = (data) => api.post('/prospects', data)
export const updateProspect = (id, data) => api.put(`/prospects/${id}`, data)
export const updateProspectStage = (id, stage) => api.patch(`/prospects/${id}/stage`, { stage })
export const updateProspectScreening = (id, data) => api.patch(`/prospects/${id}/screening`, data)
export const convertProspect = (id, tenancyId) => api.post(`/prospects/${id}/convert`, { tenancyId })
export const deleteProspect = (id) => api.delete(`/prospects/${id}`)
