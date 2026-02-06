export const TRANSACTION_TYPES = {
  NEC: 'Name Enquiry',
  FTD: 'Fund Transfer Debit',
  FTC: 'Fund Transfer Credit',
  TSQ: 'Transaction Status Query',
  REV: 'Reversal',
}

export const TRANSACTION_STATUSES = {
  INITIATED: { label: 'Initiated', color: 'secondary' },
  PROCESSING: { label: 'Processing', color: 'warning' },
  FTD_PENDING: { label: 'FTD Pending', color: 'warning' },
  FTD_SUCCESS: { label: 'FTD Success', color: 'success' },
  FTC_PENDING: { label: 'FTC Pending', color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'success' },
  FAILED: { label: 'Failed', color: 'destructive' },
  TIMEOUT: { label: 'Timeout', color: 'destructive' },
  REVERSAL_PENDING: { label: 'Reversal Pending', color: 'warning' },
  REVERSAL_SUCCESS: { label: 'Reversal Success', color: 'success' },
  REVERSAL_FAILED: { label: 'Reversal Failed', color: 'destructive' },
}

export const CALLBACK_STATUSES = {
  PENDING: { label: 'Pending', color: 'warning' },
  DELIVERED: { label: 'Delivered', color: 'success' },
  FAILED: { label: 'Failed', color: 'destructive' },
}

export const USER_ROLES = {
  admin: { label: 'Administrator', color: 'primary' },
  it: { label: 'IT Team', color: 'blue' },
  operations: { label: 'Operations', color: 'green' },
  business: { label: 'Business', color: 'purple' },
  fraud: { label: 'Fraud Team', color: 'red' },
  management: { label: 'Management', color: 'orange' },
  ceo: { label: 'CEO', color: 'gold' },
  bank: { label: 'Bank', color: 'teal' },
}

export const NAV_ITEMS = [
  {
    title: 'IT',
    path: '/it',
    roles: ['it', 'admin'],
    icon: 'Server',
    children: [
      { title: 'System Health', path: '/it/health', icon: 'Activity' },
      { title: 'API Logs', path: '/it/logs', icon: 'FileText' },
      { title: 'DB Metrics', path: '/it/db-metrics', icon: 'Database' },
    ],
  },
  {
    title: 'Operations',
    path: '/operations',
    roles: ['operations', 'it', 'admin'],
    icon: 'Settings',
    children: [
      { title: 'Transactions', path: '/operations/transactions', icon: 'ArrowLeftRight' },
      { title: 'Callbacks', path: '/operations/callbacks', icon: 'Webhook' },
      { title: 'TSQ Queue', path: '/operations/tsq', icon: 'RefreshCw' },
      { title: 'Reversals', path: '/operations/reversals', icon: 'Undo' },
    ],
  },
  {
    title: 'Business',
    path: '/business',
    roles: ['business', 'management', 'ceo', 'admin'],
    icon: 'BarChart3',
    children: [
      { title: 'Reports', path: '/business/reports', icon: 'FileBarChart' },
      { title: 'Analytics', path: '/business/analytics', icon: 'PieChart' },
      { title: 'Trends', path: '/business/trends', icon: 'TrendingUp' },
    ],
  },
  {
    title: 'Fraud',
    path: '/fraud',
    roles: ['fraud', 'operations', 'admin'],
    icon: 'Shield',
    children: [
      { title: 'Alerts', path: '/fraud/alerts', icon: 'AlertTriangle' },
      { title: 'Investigation', path: '/fraud/investigation', icon: 'Search' },
    ],
  },
  {
    title: 'Management',
    path: '/management',
    roles: ['management', 'ceo', 'admin'],
    icon: 'Users',
    children: [
      { title: 'KPI Dashboard', path: '/management/kpi', icon: 'Target' },
      { title: 'Performance', path: '/management/performance', icon: 'Award' },
    ],
  },
  {
    title: 'Executive',
    path: '/ceo',
    roles: ['ceo', 'admin'],
    icon: 'Crown',
  },
  {
    title: 'Bank Portal',
    path: '/bank',
    roles: ['bank', 'admin'],
    icon: 'Building2',
    children: [
      { title: 'Dashboard', path: '/bank/dashboard', icon: 'LayoutDashboard' },
      { title: 'Transactions', path: '/bank/transactions', icon: 'Receipt' },
      { title: 'Credentials', path: '/bank/credentials', icon: 'Key' },
      { title: 'Webhooks', path: '/bank/webhooks', icon: 'Webhook' },
    ],
  },
]
