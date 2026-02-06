import { useQuery } from '@tanstack/react-query'
import { reportService } from '@/services/report.service'
import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/common/LoadingSpinner'
import { RefreshCw, Server, Database, Wifi, Activity, HardDrive, Cpu, Clock } from 'lucide-react'

function HealthIndicator({ status }) {
  const colors = {
    healthy: 'success',
    degraded: 'warning',
    down: 'destructive',
  }
  return <Badge variant={colors[status] || 'secondary'}>{status?.toUpperCase()}</Badge>
}

function ServiceCard({ name, status, latency, details }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{name}</CardTitle>
          <HealthIndicator status={status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {latency !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Latency</span>
              <span className="font-mono">{latency}ms</span>
            </div>
          )}
          {details && Object.entries(details).map(([key, value]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{key}</span>
              <span className="font-mono">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function SystemHealth() {
  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: reportService.getSystemHealth,
    refetchInterval: 30000,
  })

  if (isLoading) return <PageLoading />

  // Mock data for demo - replace with actual API response
  const systemData = health || {
    overall: 'healthy',
    uptime: '15d 7h 23m',
    services: {
      api: { status: 'healthy', latency: 12 },
      database: { status: 'healthy', latency: 3, connections: 15, maxConnections: 100 },
      gip: { status: 'healthy', latency: 125 },
      redis: { status: 'healthy', latency: 1 },
    },
    system: {
      cpu: 23,
      memory: 67,
      disk: 45,
    },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-muted-foreground">Monitor system components and infrastructure</p>
        </div>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card className={systemData.overall === 'healthy' ? 'bg-green-50 dark:bg-green-950 border-green-200' : 'bg-amber-50 dark:bg-amber-950 border-amber-200'}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Activity className={`h-8 w-8 ${systemData.overall === 'healthy' ? 'text-green-500' : 'text-amber-500'}`} />
              <div>
                <h2 className="text-xl font-bold">System Status: {systemData.overall?.toUpperCase()}</h2>
                <p className="text-sm text-muted-foreground">Uptime: {systemData.uptime}</p>
              </div>
            </div>
            <HealthIndicator status={systemData.overall} />
          </div>
        </CardContent>
      </Card>

      {/* System Resources */}
      <div>
        <h3 className="text-lg font-semibold mb-4">System Resources</h3>
        <StatsGrid columns={3}>
          <StatCard
            title="CPU Usage"
            value={`${systemData.system?.cpu || 0}%`}
            icon={Cpu}
            trend={systemData.system?.cpu > 80 ? 'down' : 'up'}
          />
          <StatCard
            title="Memory Usage"
            value={`${systemData.system?.memory || 0}%`}
            icon={HardDrive}
            trend={systemData.system?.memory > 80 ? 'down' : 'up'}
          />
          <StatCard
            title="Disk Usage"
            value={`${systemData.system?.disk || 0}%`}
            icon={Database}
            trend={systemData.system?.disk > 80 ? 'down' : 'up'}
          />
        </StatsGrid>
      </div>

      {/* Services */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Services</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ServiceCard
            name="API Server"
            status={systemData.services?.api?.status}
            latency={systemData.services?.api?.latency}
            details={{ 'Requests/min': '142' }}
          />
          <ServiceCard
            name="Database"
            status={systemData.services?.database?.status}
            latency={systemData.services?.database?.latency}
            details={{
              'Connections': `${systemData.services?.database?.connections || 0}/${systemData.services?.database?.maxConnections || 100}`,
              'Pool Size': '20',
            }}
          />
          <ServiceCard
            name="GhIPSS GIP"
            status={systemData.services?.gip?.status}
            latency={systemData.services?.gip?.latency}
            details={{ 'Last Success': '2m ago' }}
          />
          <ServiceCard
            name="Redis Cache"
            status={systemData.services?.redis?.status}
            latency={systemData.services?.redis?.latency}
            details={{ 'Hit Rate': '94%' }}
          />
        </div>
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent System Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { time: '2 mins ago', event: 'GIP health check passed', type: 'success' },
              { time: '15 mins ago', event: 'Database connection pool scaled to 20', type: 'info' },
              { time: '1 hour ago', event: 'Memory usage peaked at 78%', type: 'warning' },
              { time: '3 hours ago', event: 'System restart completed', type: 'info' },
            ].map((event, i) => (
              <div key={i} className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground w-24">{event.time}</span>
                <Badge variant={event.type === 'success' ? 'success' : event.type === 'warning' ? 'warning' : 'secondary'}>
                  {event.type}
                </Badge>
                <span>{event.event}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
