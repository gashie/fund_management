import { create } from 'zustand'

export const useNotificationStore = create((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = Date.now()
    const newNotification = {
      id,
      ...notification,
      createdAt: new Date(),
    }
    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50),
    }))
    return id
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  clearNotifications: () => {
    set({ notifications: [] })
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }))
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length
  },
}))
