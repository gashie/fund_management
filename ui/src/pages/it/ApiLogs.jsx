import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportService } from '@/services/report.service'
import { DataTable } from '@/components/common/DataTable'
import { SearchInput } from '@/components/common/SearchInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { RefreshCw, FileText, Filter } from 'lucide-react'

function StatusCodeBadge({ code }) {
  let variant = 'secondary'
  if (code >= 200 && code < 300) variant = 'success'
  else if (code >= 400 && code < 500) variant = 'warning'
  else if (code >= 500) variant = 'destructive'

  return <Badge variant={variant}>{code}</Badge>
}

function MethodBadge({ method }) {
  const colors = {
    GET: 'secondary',
    POST: 'default',
    PUT: 'warning',
    DELETE: 'destructive',
    PATCH: 'outline',
  }
  return <Badge variant={colors[method] || 'secondary'}>{method}</Badge>
}

export default function ApiLogs() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['api-logs', page, search, methodFilter, statusFilter],
    queryFn: () =>
      reportService.getApiLogs({
        page,
        limit: 50,
        search,
        method: methodFilter !== 'all' ? methodFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }),
    refetchInterval: 10000,
  })

  // Mock data for demo
  const mockLogs = [
    { id: 1, method: 'POST', path: '/api/ftd', status: 200, duration: 1250, ip: '192.168.1.100', timestamp: new Date() },
    { id: 2, method: 'POST', path: '/api/nec', status: 200, duration: 450, ip: '192.168.1.101', timestamp: new Date() },
    { id: 3, method: 'GET', path: '/api/transactions', status: 200, duration: 35, ip: '192.168.1.102', timestamp: new Date() },
    { id: 4, method: 'POST', path: '/api/ftc', status: 500, duration: 2100, ip: '192.168.1.100', timestamp: new Date() },
    { id: 5, method: 'POST', path: '/api/callback', status: 200, duration: 15, ip: '10.0.0.50', timestamp: new Date() },
  ]

  const columns = [
    {
      accessorKey: 'timestamp',
      header: 'Time',
      cell: ({ row }) => (
        <span className="text-sm font-mono">{formatDate(row.original.timestamp)}</span>
      ),
    },
    {
      accessorKey: 'method',
      header: 'Method',
      cell: ({ row }) => <MethodBadge method={row.original.method} />,
    },
    {
      accessorKey: 'path',
      header: 'Path',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.path}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusCodeBadge code={row.original.status} />,
    },
    {
      accessorKey: 'duration',
      header: 'Duration',
      cell: ({ row }) => (
        <span className={`font-mono text-sm ${row.original.duration > 1000 ? 'text-red-500' : row.original.duration > 500 ? 'text-amber-500' : 'text-green-500'}`}>
          {row.original.duration}ms
        </span>
      ),
    },
    {
      accessorKey: 'ip',
      header: 'Client IP',
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">{row.original.ip}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Logs</h1>
          <p className="text-muted-foreground">Monitor API requests and responses</p>
        </div>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
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
                placeholder="Search by path, IP..."
              />
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="2xx">2xx Success</SelectItem>
                <SelectItem value="4xx">4xx Client Error</SelectItem>
                <SelectItem value="5xx">5xx Server Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Request Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={logs?.data || mockLogs}
            loading={isLoading}
            pagination={logs ? {
              page: logs.page || 1,
              total: logs.total || mockLogs.length,
              limit: logs.limit || 50,
            } : undefined}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  )
}
