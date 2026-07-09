import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as svc from '../services/maintenance.service'

export const useMaintenance = (params) =>
  useQuery({
    queryKey: ['maintenance', params],
    queryFn: () => svc.listMaintenance(params).then((r) => r.data),
  })

export const useCreateMaintenance = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.createMaintenance,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  })
}

export const useUpdateMaintenance = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => svc.updateMaintenance(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  })
}

export const useDeleteMaintenance = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.deleteMaintenance,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  })
}

export const useMyPortal = () =>
  useQuery({
    queryKey: ['tenant-portal'],
    queryFn: () => svc.getMyPortal().then((r) => r.data),
  })
