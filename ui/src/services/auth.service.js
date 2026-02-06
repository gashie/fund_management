import api from './api'
import { useAuthStore } from '@/store/authStore'

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password })
    const { user, token, refreshToken } = response.data

    useAuthStore.getState().login(user, token, refreshToken)
    return response.data
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      // Ignore logout errors
    }
    useAuthStore.getState().logout()
  },

  async getCurrentUser() {
    const response = await api.get('/users/me')
    return response.data
  },

  async refreshToken() {
    const { refreshToken } = useAuthStore.getState()
    if (!refreshToken) throw new Error('No refresh token')

    const response = await api.post('/auth/refresh', { refreshToken })
    const { token } = response.data

    useAuthStore.getState().updateToken(token)
    return token
  },

  async forgotPassword(email) {
    const response = await api.post('/auth/forgot-password', { email })
    return response.data
  },

  async resetPassword(token, password) {
    const response = await api.post('/auth/reset-password', { token, password })
    return response.data
  },
}
