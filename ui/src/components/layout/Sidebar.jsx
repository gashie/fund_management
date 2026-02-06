import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { NAV_ITEMS } from '@/utils/constants'
import { Button } from '@/components/ui/button'
import {
  Server, Settings, BarChart3, Shield, Users, Crown, Building2,
  Activity, FileText, Database, ArrowLeftRight, Webhook, RefreshCw,
  Undo, FileBarChart, PieChart, TrendingUp, AlertTriangle, Search,
  Target, Award, LayoutDashboard, Receipt, Key, ChevronLeft, ChevronRight,
  ChevronDown
} from 'lucide-react'

const iconMap = {
  Server, Settings, BarChart3, Shield, Users, Crown, Building2,
  Activity, FileText, Database, ArrowLeftRight, Webhook, RefreshCw,
  Undo, FileBarChart, PieChart, TrendingUp, AlertTriangle, Search,
  Target, Award, LayoutDashboard, Receipt, Key,
}

function NavItem({ item, collapsed }) {
  const location = useLocation()
  const [expanded, setExpanded] = useState(location.pathname.startsWith(item.path))
  const { user } = useAuthStore()
  const Icon = iconMap[item.icon]

  // Check if user has required role
  if (!item.roles.includes(user?.role) && user?.role !== 'admin') {
    return null
  }

  const isActive = location.pathname.startsWith(item.path)

  if (!item.children) {
    return (
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )
        }
      >
        {Icon && <Icon className="h-4 w-4" />}
        {!collapsed && <span>{item.title}</span>}
      </NavLink>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="h-4 w-4" />}
          {!collapsed && <span>{item.title}</span>}
        </div>
        {!collapsed && (
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
          />
        )}
      </button>
      {!collapsed && expanded && (
        <div className="ml-4 mt-1 space-y-1 border-l pl-4">
          {item.children.map((child) => {
            const ChildIcon = iconMap[child.icon]
            return (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                {ChildIcon && <ChildIcon className="h-4 w-4" />}
                <span>{child.title}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore()
  const { user } = useAuthStore()

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">FM</span>
            </div>
            <span className="font-semibold">Fund Manager</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.path} item={item} collapsed={sidebarCollapsed} />
        ))}
      </nav>

      {/* User Info */}
      {!sidebarCollapsed && (
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-medium text-sm">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user?.name || 'User'}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
