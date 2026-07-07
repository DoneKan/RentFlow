import api from './api'

export const getDashboard = () =>
  api.get('/reports/dashboard').then((r) => r.data)

export const getMonthlyReport = (month, year) =>
  api.get('/reports/monthly', { params: { month, year } }).then((r) => r.data)

export const getPropertyReport = (id) =>
  api.get(`/reports/property/${id}`).then((r) => r.data)

export const exportReport = (params) =>
  api.get('/reports/export', { params, responseType: 'blob' }).then((r) => r.data)
