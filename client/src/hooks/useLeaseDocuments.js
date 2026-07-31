import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as svc from '../services/lease.service'

export const useLeaseDocuments = (params) =>
  useQuery({
    queryKey: ['lease-documents', params],
    queryFn: () => svc.listLeaseDocuments(params).then((r) => r.data),
  })

export const useCreateLeaseDocument = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.createLeaseDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lease-documents'] }),
  })
}

export const useSignLeaseDocument = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => svc.signLeaseDocument(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lease-documents'] }),
  })
}

export const useVoidLeaseDocument = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.voidLeaseDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lease-documents'] }),
  })
}

export async function openLeaseDocument(id) {
  const res = await svc.downloadLeaseDocument(id)
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
  window.open(url, '_blank')
  setTimeout(() => window.URL.revokeObjectURL(url), 60000)
}
