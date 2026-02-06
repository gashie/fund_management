import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportService } from '@/services/report.service'
import { StatCard, StatsGrid } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { FileBarChart, Download, Calendar, ArrowLeftRight, CheckCircle, XCircle, DollarSign } from 'lucide-react'
import { format, subDays } from 'date-fns'

export default function Reports() {
  const [reportType, setReportType] = useState('daily')
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  })

  const { data: dailySummary } = useQuery({
    queryKey: ['daily-summary', dateRange.to],
    queryFn: () => reportService.getDailySummary(dateRange.to),
  })

  // Mock data for demo
  const mockSummary = {
    totalTransactions: 1542,
    totalVolume: 15420000,
    successRate: 97.2,
    avgProcessingTime: 1.8,
    byType: {
      NEC: { count: 2100, volume: 0 },
      FTD: { count: 1542, volume: 15420000 },
      FTC: { count: 1498, volume: 14980000 },
    },
    byBank: [
      { bank: 'GCB', count: 450, volume: 4500000 },
      { bank: 'Ecobank', count: 380, volume: 3800000 },
      { bank: 'Stanbic', count: 320, volume: 3200000 },
      { bank: 'Fidelity', count: 250, volume: 2500000 },
      { bank: 'Others', count: 142, volume: 1420000 },
    ],
  }

  const handleExport = async (format) => {
    // In real implementation, call export API
    console.log(`Exporting as ${format}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Generate and export transaction reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Report Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Report Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily Summary</SelectItem>
                <SelectItem value="weekly">Weekly Summary</SelectItem>
                <SelectItem value="monthly">Monthly Summary</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-40"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-40"
              />
            </div>
            <Button>Generate Report</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <StatsGrid>
        <StatCard
          title="Total Transactions"
          value={mockSummary.totalTransactions.toLocaleString()}
          icon={ArrowLeftRight}
        />
        <StatCard
          title="Total Volume"
          value={formatCurrency(mockSummary.totalVolume)}
          icon={DollarSign}
        />
        <StatCard
          title="Success Rate"
          value={`${mockSummary.successRate}%`}
          icon={CheckCircle}
          trend="up"
        />
        <StatCard
          title="Avg Processing Time"
          value={`${mockSummary.avgProcessingTime}s`}
          icon={FileBarChart}
        />
      </StatsGrid>

      {/* By Transaction Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">By Transaction Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-right p-3 font-medium">Count</th>
                  <th className="text-right p-3 font-medium">Volume</th>
                  <th className="text-right p-3 font-medium">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(mockSummary.byType).map(([type, data]) => (
                  <tr key={type} className="border-b">
                    <td className="p-3 font-medium">{type}</td>
                    <td className="p-3 text-right">{data.count.toLocaleString()}</td>
                    <td className="p-3 text-right">{formatCurrency(data.volume)}</td>
                    <td className="p-3 text-right">
                      {((data.count / mockSummary.totalTransactions) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* By Bank */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">By Bank</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Bank</th>
                  <th className="text-right p-3 font-medium">Transactions</th>
                  <th className="text-right p-3 font-medium">Volume</th>
                  <th className="text-right p-3 font-medium">Market Share</th>
                </tr>
              </thead>
              <tbody>
                {mockSummary.byBank.map((bank) => (
                  <tr key={bank.bank} className="border-b">
                    <td className="p-3 font-medium">{bank.bank}</td>
                    <td className="p-3 text-right">{bank.count.toLocaleString()}</td>
                    <td className="p-3 text-right">{formatCurrency(bank.volume)}</td>
                    <td className="p-3 text-right">
                      {((bank.count / mockSummary.totalTransactions) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
