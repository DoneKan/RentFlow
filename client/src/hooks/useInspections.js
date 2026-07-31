import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as svc from '../services/inspection.service'

export const useInspections = (params) =>
  useQuery({
    queryKey: ['inspections', params],
    queryFn: () => svc.listInspections(params).then((r) => r.data),
  })

export const useInspection = (id) =>
  useQuery({
    queryKey: ['inspections', id],
    queryFn: () => svc.getInspection(id).then((r) => r.data),
    enabled: !!id,
  })

export const useCreateInspection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.createInspection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections'] }),
  })
}

export const useUpdateInspection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => svc.updateInspection(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['inspections'] })
      qc.invalidateQueries({ queryKey: ['inspections', id] })
    },
  })
}

export const useCompleteInspection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => svc.completeInspection(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['inspections'] })
      qc.invalidateQueries({ queryKey: ['inspections', id] })
    },
  })
}

export const useDeleteInspection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.deleteInspection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections'] }),
  })
}

export const useAddInspectionItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => svc.addInspectionItem(id, data),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['inspections', id] }),
  })
}

export const useUpdateInspectionItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, itemId, data }) => svc.updateInspectionItem(id, itemId, data),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['inspections', id] }),
  })
}

export const useUploadItemPhotos = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, itemId, files }) => svc.uploadItemPhotos(id, itemId, files),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['inspections', id] }),
  })
}

export async function openInspectionReport(id) {
  const res = await svc.downloadInspectionReport(id)
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
  window.open(url, '_blank')
  setTimeout(() => window.URL.revokeObjectURL(url), 60000)
}
