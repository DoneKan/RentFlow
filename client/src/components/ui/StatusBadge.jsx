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
  SIGNED: 'Signed',
  DECLINED: 'Declined',
  NEW: 'New',
  CONTACTED: 'Contacted',
  SHOWING_SCHEDULED: 'Showing Scheduled',
  SCREENING: 'Screening',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CONVERTED: 'Converted',
  LOST: 'Lost',
  NOT_STARTED: 'Not Started',
  SCHEDULED: 'Scheduled',
  ACCEPTED: 'Accepted',
  REVOKED: 'Revoked',
}

export default function StatusBadge({ status }) {
  if (!status) return null
  return (
    <span className={getStatusBadgeClass(status)}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}
