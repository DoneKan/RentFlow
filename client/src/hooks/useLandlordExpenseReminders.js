import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as service from '../services/landlordExpenseReminder.service'

export const LANDLORD_EXPENSE_REMINDERS_KEY = ['landlord-expense-reminders']

export function useLandlordExpenseReminders(params) {
  return useQuery({
    queryKey: [...LANDLORD_EXPENSE_REMINDERS_KEY, params],
    queryFn: () => service.getLandlordExpenseReminders(params),
    select: (res) => res.data,
  })
}

export function useCreateLandlordExpenseReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: service.createLandlordExpenseReminder,
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDLORD_EXPENSE_REMINDERS_KEY }),
  })
}

export function useUpdateLandlordExpenseReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => service.updateLandlordExpenseReminder(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDLORD_EXPENSE_REMINDERS_KEY }),
  })
}

export function useDeleteLandlordExpenseReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: service.deleteLandlordExpenseReminder,
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDLORD_EXPENSE_REMINDERS_KEY }),
  })
}
