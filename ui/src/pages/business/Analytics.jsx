import { useQuery } from '@tanstack/react-query'
import { reportService } from '@/services/report.service'
import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart } from '@/components/charts/LineChart'
import { BarChart } from '@/components/charts/BarChart'
import { PieChart } from '@/components/charts/PieChart'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Users, Building2, Clock, DollarSign, ArrowLeftRight, CheckCircle, XCircle } from 'lucide-react'

export default function Analytics() {
  // Mock data for demo
  const volumeByHour = [
    { hour: '00', volume: 120000, count: 12 },
    { hour: '02', volume: 80000, count: 8 },
    { hour: '04', volume: 50000, count: 5 },
    { hour: '06', volume: 150000, count: 15 },
    { hour: '08', volume: 450000, count: 45 },
    { hour: '10', volume: 680000, count: 68 },
    { hour: '12', volume: 520000, count: 52 },
    { hour: '14', volume: 590000, count: 59 },
    { hour: '16', volume: 720000, count: 72 },
    { hour: '18', volume: 480000, count: 48 },
    { hour: '20', volume: 320000, count: 32 },
    { hour: '22', volume: 180000, count: 18 },
  ]

  const statusDistribution = [
    { name: 'Completed', value: 1452, color: '#16a34a' },
    { name: 'Failed', value: 45, color: '#dc2626' },
    { name: 'Pending', value: 23, color: '#f59e0b' },
    { name: 'Timeout', value: 12, color: '#6b7280' },
  ]

  const bankPerformance = [
    { bank: 'GCB', success: 98.5, avgTime: 1.2 },
    { bank: 'Ecobank', success: 97.8, avgTime: 1.5 },
    { bank: 'Stanbic', success: 99.1, avgTime: 1.1 },
    { bank: 'Fidelity', success: 96.5, avgTime: 1.8 },
    { bank: 'Zenith', success: 97.2, avgTime: 1.4 },
  ]

  const weeklyTrend = [
    { day: 'Mon', volume: 2100000, transactions: 210 },
    { day: 'Tue', volume: 2450000, transactions: 245 },
    { day: 'Wed', volume: 2300000, transactions: 230 },
    { day: 'Thu', volume: 2680000, transactions: 268 },
    { day: 'Fri', volume: 2890000, transactions: 289 },
    { day: 'Sat', volume: 1200000, transactions: 120 },
    { day: 'Sun', volume: 800000, transactions: 80 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Transaction analytics and insights</p>
      </div>

      {/* Key Metrics */}
      <StatsGrid>
        <StatCard
          title="Today's Volume"
          value={formatCurrency(4520000)}
          icon={DollarSign}
          trend="up"
          trendValue="+12.5%"
          description="vs yesterday"
        />
        <StatCard
          title="Transactions Today"
          value="452"
          icon={ArrowLeftRight}
          trend="up"
          trendValue="+8.2%"
        />
        <StatCard
          title="Success Rate"
          value="97.3%"
          icon={CheckCircle}
          trend="up"
          trendValue="+0.5%"
        />
        <StatCard
          title="Avg Processing"
          value="1.4s"
          icon={Clock}
          trend="up"
          trendValue="-0.2s"
        />
      </StatsGrid>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LineChart
          data={volumeByHour}
          title="Transaction Volume by Hour"
          xKey="hour"
          lines={[
            { key: 'count', color: '#2563eb', name: 'Transactions' },
          ]}
          height={280}
        />
        <PieChart
          data={statusDistribution}
          title="Status Distribution"
          height={280}
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BarChart
          data={weeklyTrend}
          title="Weekly Transaction Trend"
          xKey="day"
          bars={[
            { key: 'transactions', color: '#2563eb', name: 'Transactions' },
          ]}
          height={280}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bank Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bankPerformance.map((bank) => (
                <div key={bank.bank} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{bank.bank}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={bank.success >= 98 ? 'text-green-500' : bank.success >= 96 ? 'text-amber-500' : 'text-red-500'}>
                      {bank.success}% success
                    </span>
                    <span className="text-muted-foreground">{bank.avgTime}s avg</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Peak Hours Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Peak Hours Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Peak Hour</div>
              <div className="text-2xl font-bold mt-1">4:00 PM - 5:00 PM</div>
              <div className="text-sm text-muted-foreground mt-1">72 transactions/hour</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Busiest Day</div>
              <div className="text-2xl font-bold mt-1">Friday</div>
              <div className="text-sm text-muted-foreground mt-1">289 transactions avg</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Quietest Period</div>
              <div className="text-2xl font-bold mt-1">2:00 AM - 4:00 AM</div>
              <div className="text-sm text-muted-foreground mt-1">~6 transactions/hour</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
