import { useQuery } from '@tanstack/react-query'
import * as svc from '../services/owner.service'

export const useMyOwnerPortal = () =>
  useQuery({
    queryKey: ['owner-portal'],
    queryFn: () => svc.getMyOwnerPortal().then((r) => r.data),
  })

export const useOwnerPropertyStatement = (propertyId, params) =>
  useQuery({
    queryKey: ['owner-portal', 'statement', propertyId, params],
    queryFn: () => svc.getOwnerPropertyStatement(propertyId, params).then((r) => r.data),
    enabled: !!propertyId,
  })
