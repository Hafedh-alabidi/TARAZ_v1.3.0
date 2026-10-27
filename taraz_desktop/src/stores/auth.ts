import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/api/types'
import { setToken } from '@/api/client'

export const STAFF_ROLES = ['admin', 'manager', 'employee'] as const
export type StaffRole = typeof STAFF_ROLES[number]

function isStaffUser(user: User | null): boolean {
  return !!user && STAFF_ROLES.includes(user.role as StaffRole)
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => boolean
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        // تطبيق الإدارة للموظفين فقط
        if (!isStaffUser(user)) {
          return false
        }
        setToken(token)
        set({ user, isAuthenticated: true })
        return true
      },
      logout: () => {
        setToken(null)
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'taraz_desktop_auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state && (!localStorage.getItem('taraz_desktop_token') || !isStaffUser(state.user))) {
          state.user = null
          state.isAuthenticated = false
        }
      },
    },
  ),
)

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin'
}

export function isAdminOrManager(user: User | null): boolean {
  return user?.role === 'admin' || user?.role === 'manager'
}
