import api from './api'

export const getTeam = () =>
  api.get('/team').then((r) => r.data)

export const updateTeamMember = (id, data) =>
  api.put(`/team/${id}`, data).then((r) => r.data)
