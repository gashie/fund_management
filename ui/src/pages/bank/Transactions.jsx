import { useState } from 'react'
import { DataTable } from '@/components/common/DataTable'
import { StatusBadge, TransactionTypeBadge } from '@/components/common/StatusBadge'
import { SearchInput } from '@/components/common/SearchInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Download, RefreshCw, Eye, Filter } from 'lucide-react'

export default function BankTransactions() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Mock transactions for this bank
  const transactions = [
    {
      id: 1,
      reference_number: 'TXN-001234',
      transaction_type: 'FTD',
      amount: 50000,
      src_account: '1234567890',
      dest_account: '0987654321',
      dest_bank: 'Ecobank',
      status: 'COMPLETED',
      created_at: new Date(),
    },
    {
      id: 2,
      reference_number: 'TXN-001233',
      transaction_type: 'FTC',
      amount: 50000,
      src_account: '1234567890',
      dest_account: '0987654321',
      dest_bank: 'Ecobank',
      status: 'COMPLETED',
      created_at: new Date(Date.now() - 3600000),
    },
    {
      id: 3,
      reference_number: 'TXN-001232',
      transaction_type: 'NEC',
      amount: 0,
      src_account: '1234567890',
      dest_account: '5555666677',
      dest_bank: 'Stanbic',
      status: 'COMPLETED',
      created_at: new Date(Date.now() - 7200000),
    },
    {
      id: 4,
      reference_number: 'TXN-001231',
      transaction_type: 'FTD',
      amount: 125000,
      src_account: '1234567890',
      dest_account: '1112223334',
      dest_bank: 'Fidelity',
      status: 'FTD_PENDING',
      created_at: new Date(Date.now() - 10800000),
    },
    {
      id: 5,
      reference_number: 'TXN-001230',
      transaction_type: 'FTD',
      amount: 75000,
      src_account: '1234567890',
      dest_account: '9998887776',
      dest_bank: 'Zenith',
      status: 'FAILED',
      created_at: new Date(Date.now() - 14400000),
    },
  ]

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
      cell: ({ row }) => row.original.amount > 0 ? formatCurrency(row.original.amount) : '-',
    },
    {
      accessorKey: 'dest_account',
      header: 'Destination',
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-sm">{row.original.dest_account}</span>
          <div className="text-xs text-muted-foreground">{row.original.dest_bank}</div>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'created_at',
      header: 'Date',
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

  const handleExport = () => {
    // Export filtered transactions to CSV
    console.log('Exporting transactions...')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Transactions</h1>
          <p className="text-muted-foreground">View and search your transaction history</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
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
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
                placeholder="From"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
                placeholder="To"
              />
            </div>
            <Button variant="secondary">Apply Filters</Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={transactions}
            emptyMessage="No transactions found"
          />
        </CardContent>
      </Card>
    </div>
  )
}
