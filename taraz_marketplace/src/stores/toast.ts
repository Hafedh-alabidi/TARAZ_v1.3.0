import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastState {
  toasts: Toast[]
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: number) => void
}

let toastId = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, type, message }] })
    // إزالة تلقائية بعد 3.5 ثانية
    setTimeout(() => get().removeToast(id), 3500)
  },
  removeToast: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().addToast('success', message),
  error: (message: string) => useToastStore.getState().addToast('error', message),
  info: (message: string) => useToastStore.getState().addToast('info', message),
}
