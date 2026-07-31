import api from './api'

export const listBudgets = (params) => api.get('/budgets', { params })
export const getBudget = (id) => api.get(`/budgets/${id}`)
export const getBudgetVariance = (id) => api.get(`/budgets/${id}/variance`)
export const createBudget = (data) => api.post('/budgets', data)
export const updateBudget = (id, data) => api.put(`/budgets/${id}`, data)
export const deleteBudget = (id) => api.delete(`/budgets/${id}`)
