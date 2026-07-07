import api from './api'

export const getInvoices = (params) =>
  api.get('/invoices', { params }).then((r) => r.data)

export const getInvoice = (id) =>
  api.get(`/invoices/${id}`).then((r) => r.data)

export const createInvoice = (data) =>
  api.post('/invoices', data).then((r) => r.data)

export const sendInvoice = (id) =>
  api.post(`/invoices/${id}/send`).then((r) => r.data)

export const sendReminder = (id) =>
  api.post(`/invoices/${id}/remind`).then((r) => r.data)

export const cancelInvoice = (id) =>
  api.put(`/invoices/${id}/cancel`).then((r) => r.data)
