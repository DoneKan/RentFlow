import api from './api'

export const getNotifications = () =>
  api.get('/notifications').then((r) => r.data)

export const markRead = (id) =>
  api.put(`/notifications/${id}/read`).then((r) => r.data)

export const markAllRead = () =>
  api.put('/notifications/read-all').then((r) => r.data)

export const deleteNotification = (id) =>
  api.delete(`/notifications/${id}`).then((r) => r.data)
