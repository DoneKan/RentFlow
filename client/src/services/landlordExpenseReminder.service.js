import api from './api'

export const getLandlordExpenseReminders = (params) =>
  api.get('/landlord-expense-reminders', { params }).then((r) => r.data)

export const getLandlordExpenseReminder = (id) =>
  api.get(`/landlord-expense-reminders/${id}`).then((r) => r.data)

export const createLandlordExpenseReminder = (data) =>
  api.post('/landlord-expense-reminders', data).then((r) => r.data)

export const updateLandlordExpenseReminder = (id, data) =>
  api.put(`/landlord-expense-reminders/${id}`, data).then((r) => r.data)

export const deleteLandlordExpenseReminder = (id) =>
  api.delete(`/landlord-expense-reminders/${id}`).then((r) => r.data)
