import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionService } from '@/services/transaction.service'
import { DataTable } from '@/components/common/DataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatDate, truncate } from '@/lib/utils'
import { Webhook, CheckCircle, XCircle, Clock, RefreshCw, RotateCcw } from 'lucide-react'

export default function CallbackQueue() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: callbacks, isLoading, refetch } = useQuery({
    queryKey: ['callbacks-pending'],
    queryFn: transactionService.getCallbacksPending,
    refetchInterval: 15000,
  })

  const retryMutation = useMutation({
    mutationFn: transactionService.retryCallback,
    onSuccess: () => {
      toast({ title: 'Callback retry initiated' })
      queryClient.invalidateQueries(['callbacks-pending'])
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Retry failed',
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
      accessorKey: 'callback_url',
      header: 'URL',
      cell: ({ row }) => (
        <span className="text-sm" title={row.original.callback_url}>
          {truncate(row.original.callback_url, 40)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} type="callback" />,
    },
    {
      accessorKey: 'attempts',
      header: 'Attempts',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.attempts} / {row.original.max_attempts}
        </span>
      ),
    },
    {
      accessorKey: 'last_error',
      header: 'Last Error',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground" title={row.original.last_error}>
          {truncate(row.original.last_error, 30) || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'next_attempt_at',
      header: 'Next Attempt',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.next_attempt_at ? formatDate(row.original.next_attempt_at) : '-'}
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
          onClick={() => retryMutation.mutate(row.original.id)}
          disabled={retryMutation.isPending}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      ),
    },
  ]

  const pendingCount = callbacks?.filter(c => c.status === 'PENDING').length || 0
  const failedCount = callbacks?.filter(c => c.status === 'FAILED').length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Callback Queue</h1>
          <p className="text-muted-foreground">Manage pending and failed webhook callbacks</p>
        </div>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <StatsGrid columns={3}>
        <StatCard
          title="Total Pending"
          value={callbacks?.length || 0}
          icon={Webhook}
        />
        <StatCard
          title="Waiting"
          value={pendingCount}
          icon={Clock}
        />
        <StatCard
          title="Failed (Retrying)"
          value={failedCount}
          icon={XCircle}
        />
      </StatsGrid>

      {/* Callbacks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Callbacks</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={callbacks || []}
            loading={isLoading}
            emptyMessage="No pending callbacks"
          />
        </CardContent>
      </Card>
    </div>
  )
}
