import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as svc from '../services/budget.service'

export const useBudgets = (params) =>
  useQuery({
    queryKey: ['budgets', params],
    queryFn: () => svc.listBudgets(params).then((r) => r.data.data),
  })

export const useBudget = (id) =>
  useQuery({
    queryKey: ['budgets', id],
    queryFn: () => svc.getBudget(id).then((r) => r.data.data),
    enabled: !!id,
  })

export const useBudgetVariance = (id) =>
  useQuery({
    queryKey: ['budgets', id, 'variance'],
    queryFn: () => svc.getBudgetVariance(id).then((r) => r.data.data),
    enabled: !!id,
  })

export const useCreateBudget = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.createBudget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

export const useDeleteBudget = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.deleteBudget,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}
