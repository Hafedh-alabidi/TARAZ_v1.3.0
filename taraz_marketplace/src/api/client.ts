import axios from 'axios'

/**
 * عميل HTTP موحّد لمتجر طراز:
 * - يضيف Token المصادقة تلقائياً
 * - يتعامل مع انتهاء الجلسة (401) بحذفها والتوجيه لتسجيل الدخول
 * - رسائل خطأ عربية واضحة
 */

const TOKEN_KEY = 'taraz_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export const api = axios.create({
  // في الإنتاج يُضبط عبر VITE_API_URL، وفي التطوير يعمل proxy الـ vite
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// إضافة التوكن لكل طلب
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Token ${token}`
  }
  return config
})

// معالجة الأخطاء المركزية
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // انتهاء الجلسة — تنظيف وتوجيه
      setToken(null)
      localStorage.removeItem('taraz_user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

/** استخراج رسالة خطأ عربية مفهومة من استجابة DRF */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined
    if (data) {
      if (typeof data.detail === 'string') return data.detail
      if (Array.isArray(data.detail) && data.detail.length) return String(data.detail[0])
      // أول حقل فيه خطأ
      const firstKey = Object.keys(data)[0]
      if (firstKey) {
        const val = data[firstKey]
        if (typeof val === 'string') return `${firstKey}: ${val}`
        if (Array.isArray(val) && val.length) return `${firstKey}: ${String(val[0])}`
      }
    }
    if (error.code === 'ERR_NETWORK') return 'تعذر الاتصال بالخادم — تحقق من اتصالك'
  }
  return 'حدث خطأ غير متوقع — حاول مجدداً'
}
