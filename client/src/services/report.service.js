import api from './api'

export const getDashboard = (params) =>
  api.get('/reports/dashboard', { params }).then((r) => r.data)

export const getFinancialOverview = (params) =>
  api.get('/reports/financial/overview', { params }).then((r) => r.data)

export const getFinancialByProperty = (params) =>
  api.get('/reports/financial/by-property', { params }).then((r) => r.data)

export const getPropertyReport = (id) =>
  api.get(`/reports/property/${id}`).then((r) => r.data)

export const exportReport = (params) =>
  api.get('/reports/export', { params, responseType: 'blob' }).then((r) => r.data)
