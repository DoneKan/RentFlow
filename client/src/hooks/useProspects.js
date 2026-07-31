import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as svc from '../services/prospect.service'

export const useProspects = (params) =>
  useQuery({
    queryKey: ['prospects', params],
    queryFn: () => svc.listProspects(params).then((r) => r.data),
  })

export const useCreateProspect = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.createProspect,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}

export const useUpdateProspect = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => svc.updateProspect(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}

export const useUpdateProspectStage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }) => svc.updateProspectStage(id, stage),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}

export const useUpdateProspectScreening = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => svc.updateProspectScreening(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}

export const useConvertProspect = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, tenancyId }) => svc.convertProspect(id, tenancyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}

export const useDeleteProspect = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.deleteProspect,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}
