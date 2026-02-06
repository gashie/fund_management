import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart } from '@/components/charts/LineChart'
import { BarChart } from '@/components/charts/BarChart'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Target, TrendingUp, Users, DollarSign, Clock, CheckCircle, AlertTriangle, Award } from 'lucide-react'

function KpiCard({ title, value, target, unit, trend }) {
  const percentage = (value / target) * 100
  const isOnTrack = percentage >= 90

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="text-2xl font-bold mt-1">
              {unit === 'currency' ? formatCurrency(value) : unit === 'percent' ? `${value}%` : value.toLocaleString()}
            </div>
          </div>
          <Badge variant={isOnTrack ? 'success' : 'warning'}>
            {percentage.toFixed(0)}% of target
          </Badge>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span className="text-muted-foreground">
              Target: {unit === 'currency' ? formatCurrency(target) : unit === 'percent' ? `${target}%` : target.toLocaleString()}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${isOnTrack ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function KpiDashboard() {
  // Mock KPI data
  const weeklyTrend = [
    { week: 'W1', volume: 45000000, target: 50000000 },
    { week: 'W2', volume: 52000000, target: 50000000 },
    { week: 'W3', volume: 48000000, target: 50000000 },
    { week: 'W4', volume: 61000000, target: 50000000 },
  ]

  const teamPerformance = [
    { team: 'Operations', score: 95 },
    { team: 'IT', score: 92 },
    { team: 'Business', score: 88 },
    { team: 'Fraud', score: 97 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">KPI Dashboard</h1>
        <p className="text-muted-foreground">Key performance indicators and targets</p>
      </div>

      {/* Summary Stats */}
      <StatsGrid>
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(8500000)}
          icon={DollarSign}
          trend="up"
          trendValue="+15.2%"
        />
        <StatCard
          title="Active Institutions"
          value="28"
          icon={Users}
          trend="up"
          trendValue="+4"
        />
        <StatCard
          title="Avg Response Time"
          value="1.4s"
          icon={Clock}
          trend="up"
          trendValue="-0.3s"
        />
        <StatCard
          title="SLA Compliance"
          value="99.2%"
          icon={Target}
          trend="up"
          trendValue="+0.5%"
        />
      </StatsGrid>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard
          title="Transaction Volume (Monthly)"
          value={206000000}
          target={200000000}
          unit="currency"
        />
        <KpiCard
          title="Transaction Count (Monthly)"
          value={18500}
          target={20000}
          unit="number"
        />
        <KpiCard
          title="Success Rate"
          value={97.5}
          target={98}
          unit="percent"
        />
        <KpiCard
          title="Customer Satisfaction"
          value={4.6}
          target={4.5}
          unit="number"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LineChart
          data={weeklyTrend}
          title="Weekly Volume vs Target"
          xKey="week"
          lines={[
            { key: 'volume', color: '#2563eb', name: 'Actual' },
            { key: 'target', color: '#dc2626', name: 'Target' },
          ]}
          height={280}
        />
        <BarChart
          data={teamPerformance}
          title="Team Performance Scores"
          xKey="team"
          bars={[{ key: 'score', color: '#2563eb', name: 'Score' }]}
          height={280}
        />
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5" />
            Monthly Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Achievements
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Transaction volume exceeded target by 3%
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  4 new institutions onboarded
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Zero critical incidents
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Customer satisfaction improved
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Areas for Improvement
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Transaction count slightly below target
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Success rate 0.5% below target
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Peak hour processing needs optimization
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
