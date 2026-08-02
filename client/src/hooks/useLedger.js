import { useQuery } from '@tanstack/react-query'
import * as svc from '../services/ledger.service'

export const useJournalEntries = (params) =>
  useQuery({
    queryKey: ['ledger', 'entries', params],
    queryFn: () => svc.listJournalEntries(params).then((r) => r.data),
    refetchOnMount: 'always',
  })

export const useTrialBalance = (params) =>
  useQuery({
    queryKey: ['ledger', 'trial-balance', params],
    queryFn: () => svc.getTrialBalance(params).then((r) => r.data.data),
    refetchOnMount: 'always',
  })
