import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { login, getDefaultRoute } = useAuthStore()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // For demo purposes - replace with actual API call
      // Simulating different user roles for testing
      const demoUsers = {
        'it@demo.com': { id: 1, name: 'IT Admin', email: 'it@demo.com', role: 'it' },
        'ops@demo.com': { id: 2, name: 'Ops Manager', email: 'ops@demo.com', role: 'operations' },
        'business@demo.com': { id: 3, name: 'Business Analyst', email: 'business@demo.com', role: 'business' },
        'fraud@demo.com': { id: 4, name: 'Fraud Analyst', email: 'fraud@demo.com', role: 'fraud' },
        'manager@demo.com': { id: 5, name: 'Management', email: 'manager@demo.com', role: 'management' },
        'ceo@demo.com': { id: 6, name: 'CEO', email: 'ceo@demo.com', role: 'ceo' },
        'bank@demo.com': { id: 7, name: 'Bank User', email: 'bank@demo.com', role: 'bank', institutionId: 1 },
        'admin@demo.com': { id: 8, name: 'Administrator', email: 'admin@demo.com', role: 'admin' },
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))

      const user = demoUsers[formData.email]
      if (user && formData.password === 'demo123') {
        login(user, 'demo-jwt-token', 'demo-refresh-token')
        toast({
          title: 'Welcome back!',
          description: `Logged in as ${user.name}`,
        })
        navigate(getDefaultRoute())
      } else {
        throw new Error('Invalid credentials')
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: error.message || 'Please check your credentials',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">FM</span>
            </div>
          </div>
          <CardTitle className="text-2xl">Fund Management</CardTitle>
          <CardDescription>Enter your credentials to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 rounded-lg bg-muted p-4">
            <p className="text-sm font-medium mb-2">Demo Credentials</p>
            <p className="text-xs text-muted-foreground">
              Use any of these emails with password: <code className="bg-background px-1 rounded">demo123</code>
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <span>it@demo.com</span>
              <span>ops@demo.com</span>
              <span>business@demo.com</span>
              <span>fraud@demo.com</span>
              <span>manager@demo.com</span>
              <span>ceo@demo.com</span>
              <span>bank@demo.com</span>
              <span>admin@demo.com</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
