import { format, formatDistanceToNow } from 'date-fns'

export function formatCurrency(amount, currency = 'UGX') {
  if (amount === null || amount === undefined) return `${currency} 0`
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return `${currency} ${num.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatDate(date) {
  if (!date) return '—'
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateShort(date) {
  if (!date) return '—'
  return format(new Date(date), 'd MMM')
}

export function formatDateTime(date) {
  if (!date) return '—'
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a")
}

export function formatTimeAgo(date) {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function getStatusBadgeClass(status) {
  const map = {
    PAID: 'badge-paid',
    ACTIVE: 'badge-paid',
    OCCUPIED: 'badge-paid',
    COMPLETED: 'badge-paid',
    PENDING: 'badge-pending',
    SENT: 'badge-pending',
    IN_PROGRESS: 'badge-pending',
    OVERDUE: 'badge-overdue',
    TERMINATED: 'badge-overdue',
    FAILED: 'badge-overdue',
    DRAFT: 'badge-draft',
    VACANT: 'badge-draft',
    CANCELLED: 'badge-draft',
    EXPIRED: 'badge-draft',
    MAINTENANCE: 'badge-pending',
    OPEN: 'badge-overdue',
    RESOLVED: 'badge-paid',
    CLOSED: 'badge-draft',
  }
  return map[status] || 'badge-draft'
}

export function getPaymentMethodLabel(method) {
  const map = {
    MTN_MOMO: 'MTN Mobile Money',
    AIRTEL_MONEY: 'Airtel Money',
    BANK_TRANSFER: 'Bank Transfer',
    CASH: 'Cash',
  }
  return map[method] || method
}

export function getInitials(name) {
  if (!name) return '??'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}
