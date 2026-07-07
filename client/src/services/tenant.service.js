import api from './api'

export const getTenants = (params) =>
  api.get('/tenants', { params }).then((r) => r.data)

export const getTenant = (id) =>
  api.get(`/tenants/${id}`).then((r) => r.data)

export const createTenant = (data) =>
  api.post('/tenants', data).then((r) => r.data)

export const updateTenant = (id, data) =>
  api.put(`/tenants/${id}`, data).then((r) => r.data)

export const terminateTenant = (id) =>
  api.delete(`/tenants/${id}`).then((r) => r.data)
