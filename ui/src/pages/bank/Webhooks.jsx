import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { formatDate } from '@/lib/utils'
import { Webhook, CheckCircle, XCircle, Clock, Send, RefreshCw, AlertTriangle, Eye, Copy } from 'lucide-react'

export default function BankWebhooks() {
  const { toast } = useToast()
  const [webhookUrl, setWebhookUrl] = useState('https://api.yourbank.com/webhooks/fund-management')
  const [showSecret, setShowSecret] = useState(false)

  // Mock webhook config
  const webhookConfig = {
    url: 'https://api.yourbank.com/webhooks/fund-management',
    secret: 'whsec_a1b2c3d4e5f6g7h8i9j0',
    status: 'active',
    events: ['transaction.completed', 'transaction.failed', 'callback.received'],
    createdAt: new Date(Date.now() - 86400000 * 30),
  }

  const recentDeliveries = [
    { id: 1, event: 'transaction.completed', status: 200, timestamp: new Date(Date.now() - 300000), duration: 125 },
    { id: 2, event: 'transaction.completed', status: 200, timestamp: new Date(Date.now() - 600000), duration: 98 },
    { id: 3, event: 'callback.received', status: 200, timestamp: new Date(Date.now() - 1200000), duration: 145 },
    { id: 4, event: 'transaction.failed', status: 500, timestamp: new Date(Date.now() - 1800000), duration: 2500 },
    { id: 5, event: 'transaction.completed', status: 200, timestamp: new Date(Date.now() - 3600000), duration: 110 },
  ]

  const availableEvents = [
    { event: 'transaction.completed', description: 'When a transaction is successfully completed' },
    { event: 'transaction.failed', description: 'When a transaction fails' },
    { event: 'transaction.pending', description: 'When a transaction is in pending state' },
    { event: 'callback.received', description: 'When a GIP callback is received' },
    { event: 'reversal.completed', description: 'When a reversal is completed' },
  ]

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied!', description: 'Webhook secret copied to clipboard' })
  }

  const testWebhook = () => {
    toast({ title: 'Test webhook sent', description: 'Check your endpoint for the test payload' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhook Configuration</h1>
        <p className="text-muted-foreground">Receive real-time notifications for transaction events</p>
      </div>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook Endpoint
              </CardTitle>
              <CardDescription>URL where we'll send event notifications</CardDescription>
            </div>
            <Badge variant={webhookConfig.status === 'active' ? 'success' : 'secondary'}>
              {webhookConfig.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Endpoint URL</label>
            <div className="flex gap-2 mt-1">
              <Input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-api.com/webhooks"
                className="font-mono"
              />
              <Button>Save</Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Signing Secret</label>
            <p className="text-xs text-muted-foreground mb-1">Use this to verify webhook signatures</p>
            <div className="flex items-center gap-2">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={webhookConfig.secret}
                readOnly
                className="font-mono max-w-sm"
              />
              <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookConfig.secret)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={testWebhook}>
              <Send className="mr-2 h-4 w-4" />
              Send Test Event
            </Button>
            <Button variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Rotate Secret
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Event Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Subscriptions</CardTitle>
          <CardDescription>Select which events to receive notifications for</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {availableEvents.map((item) => (
              <label key={item.event} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted">
                <input
                  type="checkbox"
                  defaultChecked={webhookConfig.events.includes(item.event)}
                  className="mt-1"
                />
                <div>
                  <div className="font-mono text-sm">{item.event}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
              </label>
            ))}
          </div>
          <Button className="mt-4">Save Subscriptions</Button>
        </CardContent>
      </Card>

      {/* Recent Deliveries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Deliveries</CardTitle>
          <CardDescription>History of webhook delivery attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentDeliveries.map((delivery) => (
              <div key={delivery.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {delivery.status === 200 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <span className="font-mono text-sm">{delivery.event}</span>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(delivery.timestamp)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant={delivery.status === 200 ? 'success' : 'destructive'}>
                    {delivery.status}
                  </Badge>
                  <span className="text-muted-foreground">{delivery.duration}ms</span>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Guide */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Webhook Integration Guide</h3>
              <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>1. Configure your endpoint URL to receive POST requests</li>
                <li>2. Verify webhook signatures using the signing secret</li>
                <li>3. Return HTTP 200 within 30 seconds to acknowledge receipt</li>
                <li>4. Failed deliveries will be retried up to 3 times</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
