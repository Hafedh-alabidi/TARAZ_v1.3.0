import { create } from 'zustand'
import type { AppConfig } from '@/api/types'
import { configAPI } from '@/api/endpoints'

/**
 * مخزن إعدادات الأعمال العامة — يُحمّل مرة واحدة عند إقلاع التطبيق.
 * يحدد ما تُظهره الواجهة بصدق: هل الدفع بالبطاقة مفعل؟ بأي وضع؟
 * وبيانات التواصل الحقيقية من الخادم بدل قيم مكتوبة يدوياً.
 */
interface ConfigState {
  config: AppConfig | null
  loaded: boolean
  loadConfig: () => Promise<void>
}

export const useConfigStore = create<ConfigState>()((set) => ({
  config: null,
  loaded: false,
  loadConfig: async () => {
    try {
      const config = await configAPI.get()
      set({ config, loaded: true })
    } catch {
      // فشل التحميل — تستمر الواجهة بالإعدادات الافتراضية الصادقة
      set({ loaded: true })
    }
  },
}))
