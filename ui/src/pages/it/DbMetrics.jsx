import { useQuery } from '@tanstack/react-query'
import { reportService } from '@/services/report.service'
import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LineChart } from '@/components/charts/LineChart'
import { BarChart } from '@/components/charts/BarChart'
import { PageLoading } from '@/components/common/LoadingSpinner'
import { RefreshCw, Database, Activity, Clock, AlertTriangle } from 'lucide-react'

export default function DbMetrics() {
  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ['db-metrics'],
    queryFn: reportService.getDbMetrics,
    refetchInterval: 30000,
  })

  if (isLoading) return <PageLoading />

  // Mock data for demo
  const mockMetrics = {
    connections: { active: 15, idle: 5, total: 20, max: 100 },
    queries: { total: 15420, slow: 23, avgDuration: 12 },
    tables: [
      { name: 'transactions', rows: 1250000, size: '2.4 GB', lastVacuum: '2h ago' },
      { name: 'gip_events', rows: 3500000, size: '1.8 GB', lastVacuum: '1h ago' },
      { name: 'client_callbacks', rows: 450000, size: '890 MB', lastVacuum: '3h ago' },
      { name: 'institutions', rows: 45, size: '128 KB', lastVacuum: '6h ago' },
    ],
    slowQueries: [
      { query: 'SELECT * FROM transactions WHERE...', duration: 1250, count: 12 },
      { query: 'UPDATE client_callbacks SET...', duration: 890, count: 8 },
      { query: 'INSERT INTO gip_events...', duration: 650, count: 45 },
    ],
  }

  const queryTrendData = [
    { time: '00:00', queries: 120, avgMs: 15 },
    { time: '04:00', queries: 45, avgMs: 8 },
    { time: '08:00', queries: 350, avgMs: 18 },
    { time: '12:00', queries: 520, avgMs: 22 },
    { time: '16:00', queries: 480, avgMs: 20 },
    { time: '20:00', queries: 280, avgMs: 14 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Database Metrics</h1>
          <p className="text-muted-foreground">PostgreSQL performance monitoring</p>
        </div>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Connection Stats */}
      <StatsGrid>
        <StatCard
          title="Active Connections"
          value={mockMetrics.connections.active}
          icon={Database}
          description={`of ${mockMetrics.connections.max} max`}
        />
        <StatCard
          title="Idle Connections"
          value={mockMetrics.connections.idle}
          icon={Clock}
        />
        <StatCard
          title="Total Queries Today"
          value={mockMetrics.queries.total.toLocaleString()}
          icon={Activity}
        />
        <StatCard
          title="Slow Queries"
          value={mockMetrics.queries.slow}
          icon={AlertTriangle}
          trend={mockMetrics.queries.slow > 10 ? 'down' : 'up'}
          description=">500ms"
        />
      </StatsGrid>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LineChart
          data={queryTrendData}
          title="Query Performance (Today)"
          xKey="time"
          lines={[
            { key: 'queries', color: '#2563eb', name: 'Queries' },
            { key: 'avgMs', color: '#16a34a', name: 'Avg Duration (ms)' },
          ]}
          height={250}
        />
        <BarChart
          data={mockMetrics.tables.map(t => ({
            name: t.name,
            rows: t.rows / 1000,
          }))}
          title="Table Sizes (K rows)"
          bars={[{ key: 'rows', color: '#2563eb', name: 'Rows (K)' }]}
          height={250}
        />
      </div>

      {/* Table Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Table Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Table</th>
                  <th className="text-right p-3 font-medium">Rows</th>
                  <th className="text-right p-3 font-medium">Size</th>
                  <th className="text-right p-3 font-medium">Last Vacuum</th>
                </tr>
              </thead>
              <tbody>
                {mockMetrics.tables.map((table) => (
                  <tr key={table.name} className="border-b">
                    <td className="p-3 font-mono">{table.name}</td>
                    <td className="p-3 text-right">{table.rows.toLocaleString()}</td>
                    <td className="p-3 text-right">{table.size}</td>
                    <td className="p-3 text-right text-muted-foreground">{table.lastVacuum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Slow Queries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Slow Queries (Last 24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockMetrics.slowQueries.map((sq, i) => (
              <div key={i} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <code className="text-sm text-muted-foreground block truncate max-w-xl">
                    {sq.query}
                  </code>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <Badge variant="warning">{sq.duration}ms</Badge>
                  <span className="text-sm text-muted-foreground">{sq.count}x</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
