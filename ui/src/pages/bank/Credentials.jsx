import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Key, Eye, EyeOff, Copy, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export default function BankCredentials() {
  const { toast } = useToast()
  const [showApiKey, setShowApiKey] = useState(false)
  const [showApiSecret, setShowApiSecret] = useState(false)

  // Mock credentials
  const credentials = {
    apiKey: 'pk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    apiSecret: 'sk_live_x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4',
    createdAt: new Date(Date.now() - 86400000 * 30),
    lastUsed: new Date(Date.now() - 3600000),
    status: 'active',
  }

  const ipWhitelist = [
    { ip: '192.168.1.100', label: 'Production Server', added: '2024-01-15' },
    { ip: '10.0.0.50', label: 'Backup Server', added: '2024-02-01' },
  ]

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    })
  }

  const maskSecret = (secret) => {
    return secret.substring(0, 12) + '••••••••••••••••••••••••'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Credentials</h1>
        <p className="text-muted-foreground">Manage your API keys and access settings</p>
      </div>

      {/* Warning */}
      <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-100">Keep your credentials secure</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Never share your API secret or commit it to version control.
                Use environment variables to store credentials securely.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>Your live API credentials for production use</CardDescription>
            </div>
            <Badge variant={credentials.status === 'active' ? 'success' : 'secondary'}>
              {credentials.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key */}
          <div>
            <label className="text-sm font-medium">API Key</label>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={credentials.apiKey}
                  readOnly
                  className="font-mono pr-20"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(credentials.apiKey, 'API Key')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* API Secret */}
          <div>
            <label className="text-sm font-medium">API Secret</label>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 relative">
                <Input
                  type={showApiSecret ? 'text' : 'password'}
                  value={credentials.apiSecret}
                  readOnly
                  className="font-mono pr-20"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowApiSecret(!showApiSecret)}
                  >
                    {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(credentials.apiSecret, 'API Secret')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Created: {credentials.createdAt.toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Last used: {credentials.lastUsed.toLocaleDateString()}
            </div>
          </div>

          <div className="pt-4 border-t flex gap-2">
            <Button variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Rotate Keys
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* IP Whitelist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">IP Whitelist</CardTitle>
          <CardDescription>Only requests from these IPs will be accepted</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ipWhitelist.map((item) => (
              <div key={item.ip} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <span className="font-mono">{item.ip}</span>
                  <span className="text-sm text-muted-foreground ml-2">({item.label})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Added {item.added}</span>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Input placeholder="Enter IP address" className="max-w-xs" />
            <Input placeholder="Label (optional)" className="max-w-xs" />
            <Button>Add IP</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
