import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LineChart } from '@/components/charts/LineChart'
import { PieChart } from '@/components/charts/PieChart'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, TrendingUp, Users, Activity, CheckCircle, AlertTriangle, Building2 } from 'lucide-react'

export default function Executive() {
  // Mock executive data
  const revenueData = [
    { month: 'Jan', revenue: 6500000 },
    { month: 'Feb', revenue: 7200000 },
    { month: 'Mar', revenue: 6800000 },
    { month: 'Apr', revenue: 8100000 },
    { month: 'May', revenue: 7800000 },
    { month: 'Jun', revenue: 8500000 },
  ]

  const marketShare = [
    { name: 'GCB', value: 22, color: '#2563eb' },
    { name: 'Ecobank', value: 18, color: '#16a34a' },
    { name: 'Stanbic', value: 15, color: '#dc2626' },
    { name: 'Fidelity', value: 13, color: '#f59e0b' },
    { name: 'Others', value: 32, color: '#6b7280' },
  ]

  const keyMetrics = {
    monthlyRevenue: 8500000,
    revenueGrowth: 15.2,
    totalVolume: 206000000,
    volumeGrowth: 24.5,
    activeInstitutions: 28,
    newInstitutions: 4,
    systemUptime: 99.95,
    avgSuccessRate: 97.5,
  }

  const criticalAlerts = [
    { type: 'warning', message: 'Success rate slightly below 98% target' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Executive Dashboard</h1>
        <p className="text-muted-foreground">High-level business overview</p>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <h3 className="font-medium text-amber-900 dark:text-amber-100">Attention Required</h3>
                <ul className="mt-2 space-y-1">
                  {criticalAlerts.map((alert, i) => (
                    <li key={i} className="text-sm text-amber-700 dark:text-amber-300">
                      {alert.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <StatsGrid>
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(keyMetrics.monthlyRevenue)}
          icon={DollarSign}
          trend="up"
          trendValue={`+${keyMetrics.revenueGrowth}%`}
          description="vs last month"
        />
        <StatCard
          title="Transaction Volume"
          value={formatCurrency(keyMetrics.totalVolume)}
          icon={TrendingUp}
          trend="up"
          trendValue={`+${keyMetrics.volumeGrowth}%`}
        />
        <StatCard
          title="Active Institutions"
          value={keyMetrics.activeInstitutions}
          icon={Users}
          trend="up"
          trendValue={`+${keyMetrics.newInstitutions} new`}
        />
        <StatCard
          title="System Uptime"
          value={`${keyMetrics.systemUptime}%`}
          icon={Activity}
          trend="up"
        />
      </StatsGrid>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LineChart
          data={revenueData}
          title="Revenue Trend (6 months)"
          xKey="month"
          lines={[{ key: 'revenue', color: '#2563eb', name: 'Revenue' }]}
          height={280}
        />
        <PieChart
          data={marketShare}
          title="Market Share by Institution"
          height={280}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Key Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                <div>
                  <div className="font-medium">Record Monthly Volume</div>
                  <div className="text-sm text-muted-foreground">GHS 206M processed this month</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                <div>
                  <div className="font-medium">4 New Banks Onboarded</div>
                  <div className="text-sm text-muted-foreground">Total partners now at 28</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                <div>
                  <div className="font-medium">99.95% System Uptime</div>
                  <div className="text-sm text-muted-foreground">Exceeding SLA requirements</div>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'GCB Bank', volume: 45000000, growth: 12 },
                { name: 'Ecobank', volume: 38000000, growth: 8 },
                { name: 'Stanbic Bank', volume: 32000000, growth: 5 },
              ].map((bank, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted'}`}>
                      {i + 1}
                    </span>
                    <span className="font-medium">{bank.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(bank.volume)}</div>
                    <div className="text-xs text-green-500">+{bank.growth}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
