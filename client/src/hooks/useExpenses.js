import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as expenseService from '../services/expense.service'

export const EXPENSES_KEY = ['expenses']

export function useExpenses(params) {
  return useQuery({
    queryKey: [...EXPENSES_KEY, params],
    queryFn: () => expenseService.getExpenses(params),
    select: (res) => res.data,
  })
}

export function useExpenseSummary(params) {
  return useQuery({
    queryKey: ['expense-summary', params],
    queryFn: () => expenseService.getExpenseSummary(params),
    select: (res) => res.data,
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: expenseService.createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEY })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => expenseService.updateExpense(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_KEY }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: expenseService.deleteExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEY })
      qc.invalidateQueries({ queryKey: ['expense-summary'] })
    },
  })
}
