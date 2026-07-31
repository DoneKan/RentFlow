import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as svc from '../services/account.service'

export const useAccounts = (params) =>
  useQuery({
    queryKey: ['accounts', params],
    queryFn: () => svc.listAccounts(params).then((r) => r.data),
  })

export const useCreateAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.createAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export const useUpdateAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => svc.updateAccount(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export const useSeedDefaultAccounts = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.seedDefaultAccounts,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}
