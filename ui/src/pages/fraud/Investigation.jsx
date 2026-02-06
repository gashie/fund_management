import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Search, FileText, User, Building2, Clock, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react'

// Simple textarea component
function SimpleTextarea({ className, ...props }) {
  return (
    <textarea
      className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  )
}

export default function Investigation() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCase, setSelectedCase] = useState(null)

  // Mock investigation data
  const investigations = [
    {
      id: 'INV-001',
      title: 'Suspicious velocity pattern',
      account: '1234567890',
      bank: 'GCB',
      status: 'in_progress',
      priority: 'high',
      assignee: 'John Doe',
      createdAt: new Date(Date.now() - 86400000),
      transactions: 15,
      totalAmount: 5000000,
      notes: [
        { author: 'John Doe', text: 'Initial review completed. Multiple small transactions detected.', timestamp: new Date(Date.now() - 43200000) },
        { author: 'Jane Smith', text: 'Contacted bank for additional verification.', timestamp: new Date(Date.now() - 21600000) },
      ],
    },
    {
      id: 'INV-002',
      title: 'Large transaction review',
      account: '5555666677',
      bank: 'Stanbic',
      status: 'pending_review',
      priority: 'high',
      assignee: 'Jane Smith',
      createdAt: new Date(Date.now() - 172800000),
      transactions: 1,
      totalAmount: 25000000,
      notes: [],
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Investigation</h1>
        <p className="text-muted-foreground">Manage fraud investigations and case files</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by account number, case ID, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button>Search</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cases List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Investigations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {investigations.map((inv) => (
                <div
                  key={inv.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${selectedCase?.id === inv.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                  onClick={() => setSelectedCase(inv)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">{inv.id}</span>
                        <Badge variant={inv.priority === 'high' ? 'destructive' : 'secondary'}>
                          {inv.priority}
                        </Badge>
                      </div>
                      <div className="font-medium mt-1">{inv.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Account: {inv.account} ({inv.bank})
                      </div>
                    </div>
                    <Badge variant={inv.status === 'in_progress' ? 'warning' : 'secondary'}>
                      {inv.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {inv.assignee}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(inv.createdAt, { hour: undefined, minute: undefined })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Case Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Case Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedCase ? (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid gap-4 grid-cols-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Account</div>
                    <div className="font-mono">{selectedCase.account}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Bank</div>
                    <div>{selectedCase.bank}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Transactions</div>
                    <div>{selectedCase.transactions}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Total Amount</div>
                    <div>{formatCurrency(selectedCase.totalAmount)}</div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <div className="text-sm font-medium mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Investigation Notes
                  </div>
                  <div className="space-y-3">
                    {selectedCase.notes.length > 0 ? (
                      selectedCase.notes.map((note, i) => (
                        <div key={i} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{note.author}</span>
                            <span className="text-muted-foreground">{formatDate(note.timestamp)}</span>
                          </div>
                          <p className="text-sm mt-1">{note.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No notes yet</p>
                    )}
                  </div>
                </div>

                {/* Add Note */}
                <div>
                  <SimpleTextarea placeholder="Add investigation note..." className="mb-2" />
                  <Button size="sm">Add Note</Button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" className="flex-1">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Escalate
                  </Button>
                  <Button variant="default" className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Resolve
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                Select a case to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
