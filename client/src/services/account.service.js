import api from './api'

export const listAccounts = (params) => api.get('/accounts', { params })
export const createAccount = (data) => api.post('/accounts', data)
export const updateAccount = (id, data) => api.put(`/accounts/${id}`, data)
export const deleteAccount = (id) => api.delete(`/accounts/${id}`)
export const seedDefaultAccounts = () => api.post('/accounts/seed-defaults')
