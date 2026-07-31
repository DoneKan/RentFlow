import api from './api'

export const listJournalEntries = (params) => api.get('/ledger/entries', { params })
export const getTrialBalance = (params) => api.get('/ledger/trial-balance', { params })
export const getAccountBalance = (id, params) => api.get(`/ledger/accounts/${id}/balance`, { params })
