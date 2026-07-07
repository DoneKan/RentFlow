import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as tenantService from '../services/tenant.service'

export const TENANTS_KEY = ['tenants']

export function useTenants(params) {
  return useQuery({
    queryKey: [...TENANTS_KEY, params],
    queryFn: () => tenantService.getTenants(params),
    select: (res) => res.data,
  })
}

export function useTenant(id) {
  return useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantService.getTenant(id),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useCreateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tenantService.createTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TENANTS_KEY })
      qc.invalidateQueries({ queryKey: ['properties'] })
    },
  })
}

export function useUpdateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => tenantService.updateTenant(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: TENANTS_KEY })
      qc.invalidateQueries({ queryKey: ['tenant', id] })
    },
  })
}

export function useTerminateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: tenantService.terminateTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TENANTS_KEY })
      qc.invalidateQueries({ queryKey: ['properties'] })
    },
  })
}
