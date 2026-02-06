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
import { RefreshCw, Undo, Clock, AlertTriangle, Play, CheckCircle, XCircle } from 'lucide-react'

export default function ReversalQueue() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: reversals, isLoading, refetch } = useQuery({
    queryKey: ['reversals-pending'],
    queryFn: transactionService.getReversalsPending,
    refetchInterval: 30000,
  })

  const triggerReversalMutation = useMutation({
    mutationFn: transactionService.triggerReversal,
    onSuccess: () => {
      toast({ title: 'Reversal triggered successfully' })
      queryClient.invalidateQueries(['reversals-pending'])
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Reversal trigger failed',
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
      header: 'Original Session',
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
      accessorKey: 'src_bank_code',
      header: 'From',
      cell: ({ row }) => row.original.src_bank_code,
    },
    {
      accessorKey: 'dest_bank_code',
      header: 'To',
      cell: ({ row }) => row.original.dest_bank_code,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'reversal_attempts',
      header: 'Attempts',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.reversal_attempts || 0} / 3</span>
      ),
    },
    {
      accessorKey: 'updated_at',
      header: 'Last Update',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.updated_at)}
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
          onClick={() => triggerReversalMutation.mutate(row.original.id)}
          disabled={triggerReversalMutation.isPending || row.original.reversal_attempts >= 3}
        >
          <Play className="mr-2 h-4 w-4" />
          Retry
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reversal Queue</h1>
          <p className="text-muted-foreground">Manage pending transaction reversals</p>
        </div>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <StatsGrid columns={3}>
        <StatCard
          title="Pending Reversals"
          value={reversals?.length || 0}
          icon={Undo}
        />
        <StatCard
          title="Max Attempts Reached"
          value={reversals?.filter(r => r.reversal_attempts >= 3).length || 0}
          icon={AlertTriangle}
          description="Needs manual review"
        />
        <StatCard
          title="First Attempt"
          value={reversals?.filter(r => r.reversal_attempts === 0).length || 0}
          icon={Clock}
        />
      </StatsGrid>

      {/* Warning Card */}
      <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-100">Critical: Reversal Process</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Reversals are required when FTC (Fund Transfer Credit) fails after a successful FTD (Fund Transfer Debit).
                This ensures funds are returned to the sender's account.
              </p>
              <ul className="text-sm text-amber-600 dark:text-amber-400 mt-2 list-disc list-inside">
                <li>Maximum 3 automatic retry attempts</li>
                <li>After 3 failures, manual intervention required</li>
                <li>Contact GhIPSS support for stuck reversals</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reversals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Reversals</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={reversals || []}
            loading={isLoading}
            emptyMessage="No pending reversals"
          />
        </CardContent>
      </Card>
    </div>
  )
}
