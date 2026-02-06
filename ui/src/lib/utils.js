import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount, currency = 'GHS') {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
  return new Intl.DateTimeFormat('en-GB', { ...defaultOptions, ...options }).format(new Date(date))
}

export function formatRelativeTime(date) {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now - then
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date, { hour: undefined, minute: undefined })
}

export function truncate(str, length = 20) {
  if (!str) return ''
  return str.length > length ? str.substring(0, length) + '...' : str
}

export function getStatusColor(status) {
  const colors = {
    COMPLETED: 'success',
    SUCCESS: 'success',
    DELIVERED: 'success',
    PENDING: 'warning',
    PROCESSING: 'warning',
    FTD_PENDING: 'warning',
    FTC_PENDING: 'warning',
    INITIATED: 'secondary',
    FAILED: 'destructive',
    TIMEOUT: 'destructive',
    REVERSAL_PENDING: 'warning',
    REVERSAL_SUCCESS: 'success',
    REVERSAL_FAILED: 'destructive',
  }
  return colors[status] || 'secondary'
}
