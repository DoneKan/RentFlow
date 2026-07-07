import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as invoiceService from '../services/invoice.service'

export const INVOICES_KEY = ['invoices']

export function useInvoices(params) {
  return useQuery({
    queryKey: [...INVOICES_KEY, params],
    queryFn: () => invoiceService.getInvoices(params),
    select: (res) => res.data,
  })
}

export function useInvoice(id) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoiceService.getInvoice(id),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: invoiceService.createInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES_KEY }),
  })
}

export function useSendInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: invoiceService.sendInvoice,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY })
      qc.invalidateQueries({ queryKey: ['invoice', id] })
    },
  })
}

export function useSendReminder() {
  return useMutation({ mutationFn: invoiceService.sendReminder })
}

export function useCancelInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: invoiceService.cancelInvoice,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY })
      qc.invalidateQueries({ queryKey: ['invoice', id] })
    },
  })
}
