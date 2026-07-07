import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as paymentService from '../services/payment.service'

export const PAYMENTS_KEY = ['payments']

export function usePayments(params) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, params],
    queryFn: () => paymentService.getPayments(params),
    select: (res) => res.data,
  })
}

export function usePayment(id) {
  return useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentService.getPayment(id),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: paymentService.recordPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PAYMENTS_KEY })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useInitiateMTN() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: paymentService.initiateMTN,
    onSuccess: () => qc.invalidateQueries({ queryKey: PAYMENTS_KEY }),
  })
}
