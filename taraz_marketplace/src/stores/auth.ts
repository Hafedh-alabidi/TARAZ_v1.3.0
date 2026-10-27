import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/api/types'
import { setToken } from '@/api/client'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        setToken(token)
        set({ user, isAuthenticated: true })
      },
      setUser: (user) => set({ user }),
      logout: () => {
        setToken(null)
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'taraz_auth',
      // لا نخزن التوكن هنا (يُدار في localStorage عبر client.ts)
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        // عند التحميل: إذا لا يوجد توكن، الجلسة غير صالحة
        if (state && !localStorage.getItem('taraz_token')) {
          state.user = null
          state.isAuthenticated = false
        }
      },
    },
  ),
)
