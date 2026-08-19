import api from './api'

export const getInvitations = () =>
  api.get('/invitations').then((r) => r.data)

export const createInvitation = (data) =>
  api.post('/invitations', data).then((r) => r.data)

export const revokeInvitation = (id) =>
  api.delete(`/invitations/${id}`).then((r) => r.data)

// Public — no auth required, used by the accept-invite page.
export const verifyInvitation = (token) =>
  api.get(`/invitations/verify/${token}`).then((r) => r.data)

export const acceptInvitation = (data) =>
  api.post('/invitations/accept', data).then((r) => r.data)
