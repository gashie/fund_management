import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionService } from '@/services/transaction.service'
import { DataTable } from '@/components/common/DataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatDate, formatCurrency } from '@/lib/utils'
import { RefreshCw, Search, Clock, AlertCircle, Play } from 'lucide-react'

export default function TsqManagement() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: tsqPending, isLoading, refetch } = useQuery({
    queryKey: ['tsq-pending'],
    queryFn: transactionService.getTsqPending,
    refetchInterval: 30000,
  })

  const triggerTsqMutation = useMutation({
    mutationFn: transactionService.triggerTsq,
    onSuccess: () => {
      toast({ title: 'TSQ triggered successfully' })
      queryClient.invalidateQueries(['tsq-pending'])
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'TSQ trigger failed',
        description: error.message,
      })
    },
  })

  const columns = [
    {
      accessorKey: 'reference_number',
      header: 'Reference',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.reference_number}</span>
      ),
    },
    {
      accessorKey: 'session_id',
      header: 'Session ID',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.session_id}</span>
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
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'tsq_attempts',
      header: 'TSQ Attempts',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.tsq_attempts || 0}</span>
      ),
    },
    {
      accessorKey: 'tsq_next_attempt_at',
      header: 'Next TSQ',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.tsq_next_attempt_at ? formatDate(row.original.tsq_next_attempt_at) : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => triggerTsqMutation.mutate(row.original.id)}
          disabled={triggerTsqMutation.isPending}
        >
          <Play className="mr-2 h-4 w-4" />
          Trigger TSQ
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TSQ Management</h1>
          <p className="text-muted-foreground">Transaction Status Query pending transactions</p>
        </div>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <StatsGrid columns={3}>
        <StatCard
          title="Pending TSQ"
          value={tsqPending?.length || 0}
          icon={Search}
        />
        <StatCard
          title="Due Now"
          value={tsqPending?.filter(t => new Date(t.tsq_next_attempt_at) <= new Date()).length || 0}
          icon={Clock}
        />
        <StatCard
          title="High Priority"
          value={tsqPending?.filter(t => t.tsq_attempts >= 3).length || 0}
          icon={AlertCircle}
          description="3+ attempts"
        />
      </StatsGrid>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Search className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Transaction Status Query (TSQ)</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                TSQ is used to check the final status of transactions that are stuck in pending state.
                The system automatically queries GhIPSS for status updates every 5 minutes.
              </p>
              <ul className="text-sm text-blue-600 dark:text-blue-400 mt-2 list-disc list-inside">
                <li>000/000 = Transaction successful</li>
                <li>000/990 = Still processing, retry later</li>
                <li>000/381 = Not found at receiver, mark as failed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TSQ Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transactions Pending TSQ</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={tsqPending || []}
            loading={isLoading}
            emptyMessage="No transactions pending TSQ"
          />
        </CardContent>
      </Card>
    </div>
  )
}
