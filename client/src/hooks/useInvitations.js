import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as service from '../services/invitation.service'

export const INVITATIONS_KEY = ['invitations']

export function useInvitations() {
  return useQuery({
    queryKey: INVITATIONS_KEY,
    queryFn: service.getInvitations,
    select: (res) => res.data,
  })
}

export function useCreateInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: service.createInvitation,
    onSuccess: () => qc.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  })
}

export function useRevokeInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: service.revokeInvitation,
    onSuccess: () => qc.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  })
}
