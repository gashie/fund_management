import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LineChart } from '@/components/charts/LineChart'
import { BarChart } from '@/components/charts/BarChart'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'

export default function Trends() {
  const [period, setPeriod] = useState('30')

  // Mock trend data
  const volumeTrend = Array.from({ length: 30 }, (_, i) => ({
    date: `Day ${i + 1}`,
    volume: Math.floor(Math.random() * 5000000) + 2000000,
    transactions: Math.floor(Math.random() * 300) + 150,
  }))

  const monthlyComparison = [
    { month: 'Jan', thisYear: 45000000, lastYear: 38000000 },
    { month: 'Feb', thisYear: 52000000, lastYear: 42000000 },
    { month: 'Mar', thisYear: 48000000, lastYear: 45000000 },
    { month: 'Apr', thisYear: 61000000, lastYear: 48000000 },
    { month: 'May', thisYear: 58000000, lastYear: 51000000 },
    { month: 'Jun', thisYear: 67000000, lastYear: 54000000 },
  ]

  const growthMetrics = [
    { label: 'Transaction Volume', current: 67000000, previous: 54000000, unit: 'currency' },
    { label: 'Transaction Count', current: 6700, previous: 5400, unit: 'number' },
    { label: 'Active Banks', current: 28, previous: 24, unit: 'number' },
    { label: 'Success Rate', current: 97.5, previous: 96.2, unit: 'percent' },
  ]

  const calculateGrowth = (current, previous) => {
    return ((current - previous) / previous * 100).toFixed(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trends</h1>
          <p className="text-muted-foreground">Historical trends and growth analysis</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Growth Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {growthMetrics.map((metric) => {
          const growth = parseFloat(calculateGrowth(metric.current, metric.previous))
          const isPositive = growth > 0

          return (
            <Card key={metric.label}>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{metric.label}</div>
                <div className="text-2xl font-bold mt-1">
                  {metric.unit === 'currency' ? formatCurrency(metric.current) :
                   metric.unit === 'percent' ? `${metric.current}%` :
                   metric.current.toLocaleString()}
                </div>
                <div className={`flex items-center gap-1 mt-2 text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span>{isPositive ? '+' : ''}{growth}%</span>
                  <span className="text-muted-foreground">vs last period</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Volume Trend */}
      <LineChart
        data={volumeTrend}
        title="Daily Volume Trend"
        xKey="date"
        lines={[
          { key: 'volume', color: '#2563eb', name: 'Volume (GHS)' },
        ]}
        height={300}
      />

      {/* Year over Year Comparison */}
      <BarChart
        data={monthlyComparison}
        title="Year over Year Comparison"
        xKey="month"
        bars={[
          { key: 'lastYear', color: '#94a3b8', name: 'Last Year' },
          { key: 'thisYear', color: '#2563eb', name: 'This Year' },
        ]}
        height={300}
      />

      {/* Trend Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trend Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
                <TrendingUp className="h-4 w-4" />
                Positive Trends
              </div>
              <ul className="mt-2 space-y-1 text-sm text-green-600 dark:text-green-400">
                <li>• Transaction volume up 24% YoY</li>
                <li>• Success rate improved by 1.3%</li>
                <li>• 4 new banks onboarded this quarter</li>
                <li>• Average transaction size increased 8%</li>
              </ul>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium">
                <ArrowRight className="h-4 w-4" />
                Areas to Watch
              </div>
              <ul className="mt-2 space-y-1 text-sm text-amber-600 dark:text-amber-400">
                <li>• Processing time slightly increased during peak</li>
                <li>• Callback delivery rate needs improvement</li>
                <li>• Weekend transaction volume declining</li>
                <li>• Some banks showing higher failure rates</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">30-Day Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Projected Volume</div>
              <div className="text-2xl font-bold mt-1">{formatCurrency(72000000)}</div>
              <div className="text-sm text-green-500 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" /> +7.5% growth expected
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Projected Transactions</div>
              <div className="text-2xl font-bold mt-1">7,200</div>
              <div className="text-sm text-green-500 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" /> +7.5% growth expected
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Confidence Level</div>
              <div className="text-2xl font-bold mt-1">High (85%)</div>
              <div className="text-sm text-muted-foreground mt-1">Based on historical patterns</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
