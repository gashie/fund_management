import { useState } from 'react'
import { DataTable } from '@/components/common/DataTable'
import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatCurrency } from '@/lib/utils'
import { AlertTriangle, Shield, Eye, CheckCircle, XCircle, Clock, Flag } from 'lucide-react'

function SeverityBadge({ severity }) {
  const colors = {
    high: 'destructive',
    medium: 'warning',
    low: 'secondary',
  }
  return <Badge variant={colors[severity]}>{severity.toUpperCase()}</Badge>
}

function AlertTypeBadge({ type }) {
  const labels = {
    velocity: 'Velocity',
    duplicate: 'Duplicate',
    amount: 'Amount',
    pattern: 'Pattern',
    blacklist: 'Blacklist',
  }
  return <Badge variant="outline">{labels[type] || type}</Badge>
}

export default function Alerts() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')

  // Mock alerts data
  const alerts = [
    {
      id: 1,
      type: 'velocity',
      severity: 'high',
      status: 'open',
      title: 'High transaction velocity detected',
      description: 'Account 1234567890 made 15 transactions in 5 minutes',
      account: '1234567890',
      amount: 5000000,
      bank: 'GCB',
      timestamp: new Date(),
    },
    {
      id: 2,
      type: 'duplicate',
      severity: 'medium',
      status: 'investigating',
      title: 'Potential duplicate transaction',
      description: 'Same amount to same beneficiary within 2 minutes',
      account: '0987654321',
      amount: 150000,
      bank: 'Ecobank',
      timestamp: new Date(Date.now() - 3600000),
    },
    {
      id: 3,
      type: 'amount',
      severity: 'high',
      status: 'open',
      title: 'Unusually large transaction',
      description: 'Transaction amount exceeds daily average by 500%',
      account: '5555666677',
      amount: 25000000,
      bank: 'Stanbic',
      timestamp: new Date(Date.now() - 7200000),
    },
    {
      id: 4,
      type: 'pattern',
      severity: 'low',
      status: 'resolved',
      title: 'Unusual time pattern',
      description: 'Transaction at unusual hour for this account',
      account: '1112223334',
      amount: 50000,
      bank: 'Fidelity',
      timestamp: new Date(Date.now() - 86400000),
    },
  ]

  const columns = [
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <AlertTypeBadge type={row.original.type} />,
    },
    {
      accessorKey: 'title',
      header: 'Alert',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.title}</div>
          <div className="text-sm text-muted-foreground">{row.original.description}</div>
        </div>
      ),
    },
    {
      accessorKey: 'account',
      header: 'Account',
      cell: ({ row }) => (
        <div>
          <span className="font-mono">{row.original.account}</span>
          <div className="text-xs text-muted-foreground">{row.original.bank}</div>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => formatCurrency(row.original.amount),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'resolved' ? 'success' : row.original.status === 'investigating' ? 'warning' : 'secondary'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'timestamp',
      header: 'Time',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.timestamp)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Review
        </Button>
      ),
    },
  ]

  const openAlerts = alerts.filter(a => a.status === 'open').length
  const highSeverity = alerts.filter(a => a.severity === 'high').length
  const investigating = alerts.filter(a => a.status === 'investigating').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fraud Alerts</h1>
          <p className="text-muted-foreground">Monitor and investigate suspicious activities</p>
        </div>
      </div>

      {/* Stats */}
      <StatsGrid>
        <StatCard
          title="Open Alerts"
          value={openAlerts}
          icon={AlertTriangle}
          trend={openAlerts > 5 ? 'down' : 'up'}
        />
        <StatCard
          title="High Severity"
          value={highSeverity}
          icon={Flag}
          className={highSeverity > 0 ? 'border-red-200 dark:border-red-800' : ''}
        />
        <StatCard
          title="Under Investigation"
          value={investigating}
          icon={Eye}
        />
        <StatCard
          title="Resolved Today"
          value={3}
          icon={CheckCircle}
        />
      </StatsGrid>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={alerts}
            emptyMessage="No alerts found"
          />
        </CardContent>
      </Card>
    </div>
  )
}
