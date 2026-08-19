import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as service from '../services/team.service'

export const TEAM_KEY = ['team']

export function useTeam() {
  return useQuery({
    queryKey: TEAM_KEY,
    queryFn: service.getTeam,
    select: (res) => res.data,
  })
}

export function useUpdateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => service.updateTeamMember(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAM_KEY }),
  })
}
