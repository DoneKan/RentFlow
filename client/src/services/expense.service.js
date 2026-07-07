import api from './api'

export const getExpenses = (params) =>
  api.get('/expenses', { params }).then((r) => r.data)

export const getExpense = (id) =>
  api.get(`/expenses/${id}`).then((r) => r.data)

export const createExpense = (data) =>
  api.post('/expenses', data, {
    headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
  }).then((r) => r.data)

export const updateExpense = (id, data) =>
  api.put(`/expenses/${id}`, data).then((r) => r.data)

export const deleteExpense = (id) =>
  api.delete(`/expenses/${id}`).then((r) => r.data)

export const getExpenseSummary = (params) =>
  api.get('/expenses/summary', { params }).then((r) => r.data)
