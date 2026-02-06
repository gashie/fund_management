import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart } from '@/components/charts/BarChart'
import { formatCurrency } from '@/lib/utils'
import { Building2, TrendingUp, TrendingDown, Award, Target, Users } from 'lucide-react'

export default function Performance() {
  // Mock performance data
  const institutionRankings = [
    { rank: 1, name: 'GCB Bank', volume: 45000000, count: 4500, successRate: 99.2, change: 'up' },
    { rank: 2, name: 'Ecobank', volume: 38000000, count: 3800, successRate: 98.5, change: 'up' },
    { rank: 3, name: 'Stanbic Bank', volume: 32000000, count: 3200, successRate: 98.8, change: 'down' },
    { rank: 4, name: 'Fidelity Bank', volume: 28000000, count: 2800, successRate: 97.5, change: 'up' },
    { rank: 5, name: 'Zenith Bank', volume: 25000000, count: 2500, successRate: 97.2, change: 'same' },
    { rank: 6, name: 'Access Bank', volume: 22000000, count: 2200, successRate: 96.8, change: 'down' },
    { rank: 7, name: 'UBA', volume: 18000000, count: 1800, successRate: 97.0, change: 'up' },
    { rank: 8, name: 'First Atlantic', volume: 15000000, count: 1500, successRate: 96.5, change: 'same' },
  ]

  const slaMetrics = [
    { metric: 'API Response Time', target: '<2s', actual: '1.4s', status: 'met' },
    { metric: 'Transaction Success Rate', target: '>98%', actual: '97.5%', status: 'missed' },
    { metric: 'Callback Delivery', target: '<30s', actual: '25s', status: 'met' },
    { metric: 'System Uptime', target: '99.9%', actual: '99.95%', status: 'met' },
    { metric: 'Support Response', target: '<4h', actual: '2.5h', status: 'met' },
  ]

  const monthlyVolume = institutionRankings.slice(0, 6).map(i => ({
    name: i.name.split(' ')[0],
    volume: i.volume / 1000000,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Performance</h1>
        <p className="text-muted-foreground">Institution rankings and SLA compliance</p>
      </div>

      {/* Volume Chart */}
      <BarChart
        data={monthlyVolume}
        title="Top Institutions by Volume (Millions GHS)"
        xKey="name"
        bars={[{ key: 'volume', color: '#2563eb', name: 'Volume (M)' }]}
        height={280}
      />

      {/* Institution Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5" />
            Institution Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Rank</th>
                  <th className="text-left p-3 font-medium">Institution</th>
                  <th className="text-right p-3 font-medium">Volume</th>
                  <th className="text-right p-3 font-medium">Transactions</th>
                  <th className="text-right p-3 font-medium">Success Rate</th>
                  <th className="text-center p-3 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {institutionRankings.map((inst) => (
                  <tr key={inst.rank} className="border-b">
                    <td className="p-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${inst.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {inst.rank}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{inst.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right">{formatCurrency(inst.volume)}</td>
                    <td className="p-3 text-right">{inst.count.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <span className={inst.successRate >= 98 ? 'text-green-500' : inst.successRate >= 96 ? 'text-amber-500' : 'text-red-500'}>
                        {inst.successRate}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {inst.change === 'up' && <TrendingUp className="h-4 w-4 text-green-500 mx-auto" />}
                      {inst.change === 'down' && <TrendingDown className="h-4 w-4 text-red-500 mx-auto" />}
                      {inst.change === 'same' && <span className="text-muted-foreground">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* SLA Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            SLA Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {slaMetrics.map((sla) => (
              <div key={sla.metric} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium">{sla.metric}</div>
                  <div className="text-sm text-muted-foreground">Target: {sla.target}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono">{sla.actual}</span>
                  <Badge variant={sla.status === 'met' ? 'success' : 'destructive'}>
                    {sla.status === 'met' ? 'Met' : 'Missed'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
