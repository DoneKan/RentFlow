import api from './api'

export const getPayments = (params) =>
  api.get('/payments', { params }).then((r) => r.data)

export const getPayment = (id) =>
  api.get(`/payments/${id}`).then((r) => r.data)

export const recordPayment = (data) =>
  api.post('/payments', data).then((r) => r.data)

export const downloadReceipt = (id) =>
  api.get(`/payments/${id}/receipt`, { responseType: 'blob' }).then((r) => r.data)

export const initiateMTN = (data) =>
  api.post('/payments/mtn/initiate', data).then((r) => r.data)

export const initiateAirtel = (data) =>
  api.post('/payments/airtel/initiate', data).then((r) => r.data)
