import { Badge } from '@/components/ui/badge'
import { TRANSACTION_STATUSES, CALLBACK_STATUSES } from '@/utils/constants'

export function StatusBadge({ status, type = 'transaction' }) {
  const statusConfig = type === 'callback' ? CALLBACK_STATUSES : TRANSACTION_STATUSES
  const config = statusConfig[status] || { label: status, color: 'secondary' }

  return (
    <Badge variant={config.color}>
      {config.label}
    </Badge>
  )
}

export function TransactionTypeBadge({ type }) {
  const colors = {
    NEC: 'secondary',
    FTD: 'default',
    FTC: 'default',
    TSQ: 'outline',
    REV: 'warning',
  }

  return (
    <Badge variant={colors[type] || 'secondary'}>
      {type}
    </Badge>
  )
}
