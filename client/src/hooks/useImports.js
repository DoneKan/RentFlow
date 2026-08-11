import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as importService from '../services/import.service'
import { PROPERTIES_KEY } from './useProperties'

// Maps an import entityType to the query keys that should refresh once a
// batch is confirmed — extend this as Units/Tenancies/Invoices/Expenses
// imports are added.
const INVALIDATES_BY_ENTITY = {
  properties: [PROPERTIES_KEY],
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
