import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { useAuthStore } from '@/store/authStore'

// Layout
import MainLayout from '@/components/layout/MainLayout'
import RoleGuard from '@/components/layout/RoleGuard'

// Auth Pages
import Login from '@/pages/auth/Login'

// IT Pages
import SystemHealth from '@/pages/it/SystemHealth'
import ApiLogs from '@/pages/it/ApiLogs'
import DbMetrics from '@/pages/it/DbMetrics'

// Operations Pages
import TransactionMonitor from '@/pages/operations/TransactionMonitor'
import CallbackQueue from '@/pages/operations/CallbackQueue'
import TsqManagement from '@/pages/operations/TsqManagement'
import ReversalQueue from '@/pages/operations/ReversalQueue'

// Business Pages
import Reports from '@/pages/business/Reports'
import Analytics from '@/pages/business/Analytics'
import Trends from '@/pages/business/Trends'

// Fraud Pages
import Alerts from '@/pages/fraud/Alerts'
import Investigation from '@/pages/fraud/Investigation'

// Management Pages
import KpiDashboard from '@/pages/management/KpiDashboard'
import Performance from '@/pages/management/Performance'

// CEO Pages
import Executive from '@/pages/ceo/Executive'

// Bank Portal Pages
import BankDashboard from '@/pages/bank/Dashboard'
import BankTransactions from '@/pages/bank/Transactions'
import BankCredentials from '@/pages/bank/Credentials'
import BankWebhooks from '@/pages/bank/Webhooks'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login />
        } />

        {/* Protected Routes */}
        <Route element={<MainLayout />}>
          {/* Default redirect based on role */}
          <Route path="/" element={<Navigate to="/operations/transactions" replace />} />

          {/* IT Routes */}
          <Route path="/it" element={<RoleGuard allowedRoles={['it', 'admin']} />}>
            <Route index element={<Navigate to="/it/health" replace />} />
            <Route path="health" element={<SystemHealth />} />
            <Route path="logs" element={<ApiLogs />} />
            <Route path="db-metrics" element={<DbMetrics />} />
          </Route>

          {/* Operations Routes */}
          <Route path="/operations" element={<RoleGuard allowedRoles={['operations', 'it', 'admin']} />}>
            <Route index element={<Navigate to="/operations/transactions" replace />} />
            <Route path="transactions" element={<TransactionMonitor />} />
            <Route path="callbacks" element={<CallbackQueue />} />
            <Route path="tsq" element={<TsqManagement />} />
            <Route path="reversals" element={<ReversalQueue />} />
          </Route>

          {/* Business Routes */}
          <Route path="/business" element={<RoleGuard allowedRoles={['business', 'management', 'ceo', 'admin']} />}>
            <Route index element={<Navigate to="/business/reports" replace />} />
            <Route path="reports" element={<Reports />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="trends" element={<Trends />} />
          </Route>

          {/* Fraud Routes */}
          <Route path="/fraud" element={<RoleGuard allowedRoles={['fraud', 'operations', 'admin']} />}>
            <Route index element={<Navigate to="/fraud/alerts" replace />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="investigation" element={<Investigation />} />
          </Route>

          {/* Management Routes */}
          <Route path="/management" element={<RoleGuard allowedRoles={['management', 'ceo', 'admin']} />}>
            <Route index element={<Navigate to="/management/kpi" replace />} />
            <Route path="kpi" element={<KpiDashboard />} />
            <Route path="performance" element={<Performance />} />
          </Route>

          {/* CEO Routes */}
          <Route path="/ceo" element={<RoleGuard allowedRoles={['ceo', 'admin']} />}>
            <Route index element={<Executive />} />
          </Route>

          {/* Bank Portal Routes */}
          <Route path="/bank" element={<RoleGuard allowedRoles={['bank', 'admin']} />}>
            <Route index element={<Navigate to="/bank/dashboard" replace />} />
            <Route path="dashboard" element={<BankDashboard />} />
            <Route path="transactions" element={<BankTransactions />} />
            <Route path="credentials" element={<BankCredentials />} />
            <Route path="webhooks" element={<BankWebhooks />} />
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App
