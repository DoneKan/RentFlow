import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as propertyService from '../services/property.service'

export const PROPERTIES_KEY = ['properties']

export function useProperties(params) {
  return useQuery({
    queryKey: [...PROPERTIES_KEY, params],
    queryFn: () => propertyService.getProperties(params),
    select: (res) => res.data,
  })
}

export function useProperty(id) {
  return useQuery({
    queryKey: ['property', id],
    queryFn: () => propertyService.getProperty(id),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function usePropertyUnits(id) {
  return useQuery({
    queryKey: ['property-units', id],
    queryFn: () => propertyService.getPropertyUnits(id),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: propertyService.createProperty,
    onSuccess: () => qc.invalidateQueries({ queryKey: PROPERTIES_KEY }),
  })
}

export function useUpdateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => propertyService.updateProperty(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: PROPERTIES_KEY })
      qc.invalidateQueries({ queryKey: ['property', id] })
    },
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: propertyService.deleteProperty,
    onSuccess: () => qc.invalidateQueries({ queryKey: PROPERTIES_KEY }),
  })
}
