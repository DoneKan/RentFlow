import { getStatusBadgeClass } from '../../utils/formatters'

const STATUS_LABELS = {
  PAID: 'Paid',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
  DRAFT: 'Draft',
  SENT: 'Sent',
  OCCUPIED: 'Occupied',
  VACANT: 'Vacant',
  MAINTENANCE: 'Maintenance',
  ACTIVE: 'Active',
  TERMINATED: 'Terminated',
  EXPIRED: 'Expired',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export default function StatusBadge({ status }) {
  if (!status) return null
  return (
    <span className={getStatusBadgeClass(status)}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}
