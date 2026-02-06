import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (userData, token, refreshToken) => {
        set({
          user: userData,
          token,
          refreshToken,
          isAuthenticated: true,
        })
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      updateToken: (token) => {
        set({ token })
      },

      hasRole: (roles) => {
        const { user } = get()
        if (!user) return false
        if (Array.isArray(roles)) {
          return roles.includes(user.role)
        }
        return user.role === roles
      },

      getDefaultRoute: () => {
        const { user } = get()
        if (!user) return '/login'

        const roleRoutes = {
          admin: '/operations/transactions',
          it: '/it/health',
          operations: '/operations/transactions',
          business: '/business/reports',
          fraud: '/fraud/alerts',
          management: '/management/kpi',
          ceo: '/ceo',
          bank: '/bank/dashboard',
        }
        return roleRoutes[user.role] || '/operations/transactions'
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
