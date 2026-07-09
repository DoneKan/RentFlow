import api from './api'

export const listMaintenance = (params) => api.get('/maintenance', { params })
export const getMaintenance = (id) => api.get(`/maintenance/${id}`)
export const createMaintenance = (data) => api.post('/maintenance', data)
export const updateMaintenance = (id, data) => api.patch(`/maintenance/${id}`, data)
export const deleteMaintenance = (id) => api.delete(`/maintenance/${id}`)
export const getMyPortal = () => api.get('/tenants/portal/me')
