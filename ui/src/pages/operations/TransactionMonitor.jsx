import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { transactionService } from '@/services/transaction.service'
import { DataTable } from '@/components/common/DataTable'
import { StatusBadge, TransactionTypeBadge } from '@/components/common/StatusBadge'
import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { SearchInput } from '@/components/common/SearchInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatCurrency, truncate } from '@/lib/utils'
import { ArrowLeftRight, CheckCircle, XCircle, Clock, RefreshCw, Eye } from 'lucide-react'

const columns = [
  {
    accessorKey: 'reference_number',
    header: 'Reference',
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.reference_number}</span>
    ),
  },
  {
    accessorKey: 'transaction_type',
    header: 'Type',
    cell: ({ row }) => <TransactionTypeBadge type={row.original.transaction_type} />,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => formatCurrency(row.original.amount),
  },
  {
    accessorKey: 'src_bank_code',
    header: 'From',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.src_bank_code}</span>
    ),
  },
  {
    accessorKey: 'dest_bank_code',
    header: 'To',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.dest_bank_code}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'created_at',
    header: 'Time',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.created_at)}
      </span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Button variant="ghost" size="icon">
        <Eye className="h-4 w-4" />
      </Button>
    ),
  },
]

export default function TransactionMonitor() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['transactions', page, search, statusFilter, typeFilter],
    queryFn: () =>
      transactionService.getTransactions({
        page,
        limit: 20,
        referenceNumber: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      }),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  })

  const { data: stats } = useQuery({
    queryKey: ['transaction-stats'],
    queryFn: transactionService.getStats,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transaction Monitor</h1>
          <p className="text-muted-foreground">Real-time transaction monitoring and management</p>
        </div>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <StatsGrid>
        <StatCard
          title="Today's Transactions"
          value={stats?.today_count || 0}
          icon={ArrowLeftRight}
        />
        <StatCard
          title="Successful"
          value={stats?.today_success || 0}
          icon={CheckCircle}
          trend="up"
          trendValue={stats?.today_count > 0 ? `${Math.round((stats?.today_success / stats?.today_count) * 100)}%` : '0%'}
        />
        <StatCard
          title="Failed"
          value={stats?.today_failed || 0}
          icon={XCircle}
        />
        <StatCard
          title="Pending"
          value={stats?.pending_count || 0}
          icon={Clock}
        />
      </StatsGrid>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-64">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by reference..."
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="INITIATED">Initiated</SelectItem>
                <SelectItem value="FTD_PENDING">FTD Pending</SelectItem>
                <SelectItem value="FTD_SUCCESS">FTD Success</SelectItem>
                <SelectItem value="FTC_PENDING">FTC Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="TIMEOUT">Timeout</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="NEC">NEC</SelectItem>
                <SelectItem value="FTD">FTD</SelectItem>
                <SelectItem value="FTC">FTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={transactions?.data || []}
            loading={isLoading}
            pagination={transactions ? {
              page: transactions.page,
              total: transactions.total,
              limit: transactions.limit,
            } : undefined}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  )
}
