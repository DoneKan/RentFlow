import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as importService from '../services/import.service'
import { PROPERTIES_KEY } from './useProperties'
import { TENANTS_KEY } from './useTenants'

// Maps an import entityType to the query keys that should refresh once a
// batch is confirmed — extend this as Invoices/Expenses imports are added.
// ['property-units'] partial-matches every usePropertyUnits(id) query
// regardless of id.
const INVALIDATES_BY_ENTITY = {
  properties: [PROPERTIES_KEY],
  units: [PROPERTIES_KEY, ['property-units']],
  tenancies: [TENANTS_KEY, PROPERTIES_KEY, ['property-units'], ['property-units-vacant']],
}

export function useValidateImport(entityType) {
  return useMutation({
    mutationFn: (file) => importService.validateImportFile(entityType, file),
  })
}

export function useConfirmImport(entityType) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ batchId, includeRowIds }) => importService.confirmImport(entityType, batchId, includeRowIds),
    onSuccess: () => {
      for (const key of INVALIDATES_BY_ENTITY[entityType] || []) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
  })
}
