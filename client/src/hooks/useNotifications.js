import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as notificationService from '../services/notification.service'

export const NOTIF_KEY = ['notifications']

export function useNotifications() {
  return useQuery({
    queryKey: NOTIF_KEY,
    queryFn: notificationService.getNotifications,
    select: (res) => res.data,
    refetchInterval: 30000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationService.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationService.deleteNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  })
}
