import { useAuthStore } from '@/store/authStore'
import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart } from '@/components/charts/LineChart'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeftRight, CheckCircle, XCircle, Clock, DollarSign, TrendingUp, Activity } from 'lucide-react'

export default function BankDashboard() {
  const { user } = useAuthStore()

  // Mock bank-specific data
  const stats = {
    todayTransactions: 145,
    todayVolume: 4500000,
    successRate: 98.2,
    pendingCount: 3,
    monthlyVolume: 45000000,
    monthlyGrowth: 12.5,
  }

  const weeklyData = [
    { day: 'Mon', volume: 850000, count: 28 },
    { day: 'Tue', volume: 920000, count: 32 },
    { day: 'Wed', volume: 780000, count: 26 },
    { day: 'Thu', volume: 1100000, count: 38 },
    { day: 'Fri', volume: 1250000, count: 42 },
    { day: 'Sat', volume: 450000, count: 15 },
    { day: 'Sun', volume: 320000, count: 10 },
  ]

  const recentTransactions = [
    { ref: 'TXN-001234', type: 'FTD', amount: 50000, status: 'COMPLETED', time: '2 mins ago' },
    { ref: 'TXN-001233', type: 'FTC', amount: 50000, status: 'COMPLETED', time: '5 mins ago' },
    { ref: 'TXN-001232', type: 'NEC', amount: 0, status: 'COMPLETED', time: '8 mins ago' },
    { ref: 'TXN-001231', type: 'FTD', amount: 125000, status: 'PENDING', time: '12 mins ago' },
    { ref: 'TXN-001230', type: 'FTD', amount: 75000, status: 'FAILED', time: '15 mins ago' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.name || 'Bank User'}</h1>
        <p className="text-muted-foreground">Your bank portal dashboard</p>
      </div>

      {/* Stats */}
      <StatsGrid>
        <StatCard
          title="Today's Transactions"
          value={stats.todayTransactions}
          icon={ArrowLeftRight}
        />
        <StatCard
          title="Today's Volume"
          value={formatCurrency(stats.todayVolume)}
          icon={DollarSign}
        />
        <StatCard
          title="Success Rate"
          value={`${stats.successRate}%`}
          icon={CheckCircle}
          trend="up"
        />
        <StatCard
          title="Pending"
          value={stats.pendingCount}
          icon={Clock}
        />
      </StatsGrid>

      {/* Monthly Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Monthly Volume</div>
              <div className="text-3xl font-bold mt-1">{formatCurrency(stats.monthlyVolume)}</div>
              <div className="text-sm text-green-500 flex items-center gap-1 mt-1">
                <TrendingUp className="h-4 w-4" />
                +{stats.monthlyGrowth}% from last month
              </div>
            </div>
            <Activity className="h-12 w-12 text-primary/50" />
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <LineChart
        data={weeklyData}
        title="This Week's Activity"
        xKey="day"
        lines={[
          { key: 'count', color: '#2563eb', name: 'Transactions' },
        ]}
        height={250}
      />

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentTransactions.map((txn) => (
              <div key={txn.ref} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm">{txn.ref}</span>
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded">{txn.type}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium">{txn.amount > 0 ? formatCurrency(txn.amount) : '-'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    txn.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    txn.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {txn.status}
                  </span>
                  <span className="text-sm text-muted-foreground">{txn.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
