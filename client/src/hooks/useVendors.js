import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as svc from '../services/vendor.service'

export const useVendors = (params) =>
  useQuery({
    queryKey: ['vendors', params],
    queryFn: () => svc.listVendors(params).then((r) => r.data),
  })

export const useVendorHistory = (id) =>
  useQuery({
    queryKey: ['vendors', id, 'history'],
    queryFn: () => svc.getVendorHistory(id).then((r) => r.data),
    enabled: !!id,
  })

export const useCreateVendor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.createVendor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

export const useUpdateVendor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => svc.updateVendor(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  })
}

export const useDeleteVendor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.deleteVendor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  })
}
