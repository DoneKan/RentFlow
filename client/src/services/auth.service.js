import api from './api'

export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then((r) => r.data)

export const register = (data) =>
  api.post('/auth/register', data).then((r) => r.data)

export const logout = () =>
  api.post('/auth/logout').then((r) => r.data)

export const getMe = () =>
  api.get('/auth/me').then((r) => r.data)

export const updateMe = (data) =>
  api.put('/auth/me', data).then((r) => r.data)

export const changePassword = (data) =>
  api.post('/auth/change-password', data).then((r) => r.data)
