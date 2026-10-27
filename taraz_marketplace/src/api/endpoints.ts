import { api } from './client'
import type {
  AuthResponse, Category, CreateOrderPayload, InvoiceData, LoginPayload, Order,
  Paginated, PaymentConfirmPayload, PaymentSession, Product, RegisterPayload, User,
  AppConfig,
} from './types'

// ============================================================
// الإعدادات العامة (بلا مصادقة)
// ============================================================
export const configAPI = {
  get: () => api.get<AppConfig>('/config/').then(r => r.data),
}

// ============================================================
// المصادقة
// ============================================================
export const authAPI = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login/', payload).then(r => r.data),
  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register/', payload).then(r => r.data),
  logout: () => api.post('/auth/logout/').then(r => r.data),
  me: () => api.get<User>('/users/me/').then(r => r.data),
  // ✅ استعادة كلمة المرور
  requestPasswordReset: (email: string) =>
    api.post<{ detail: string }>('/auth/password-reset/', { email }).then(r => r.data),
  confirmPasswordReset: (payload: {
    uid: string; token: string; new_password: string; new_password2: string
  }) =>
    api.post<{ detail: string }>('/auth/password-reset/confirm/', payload).then(r => r.data),
}

// ============================================================
// المنتجات والفئات
// ============================================================
export interface ProductQuery {
  search?: string
  category?: number
  ordering?: string
  page?: number
  page_size?: number
  /** ✅ المنتجات المخفضة فقط */
  on_sale?: boolean
}

/** استخراج قائمة من استجابة قد تكون مصفوفة أو مرقّمة صفحات */
function unwrapList<T>(data: T[] | Paginated<T>): T[] {
  if (Array.isArray(data)) return data
  return data.results ?? []
}

export const productsAPI = {
  list: (params?: ProductQuery) =>
    api.get<Paginated<Product>>('/products/', { params }).then(r => r.data),
  get: (id: number) =>
    api.get<Product>(`/products/${id}/`).then(r => r.data),
}

export const categoriesAPI = {
  list: () =>
    api.get<Category[] | Paginated<Category>>('/categories/')
      .then(r => unwrapList(r.data)),
}

// ============================================================
// الطلبات
// ============================================================
export const ordersAPI = {
  create: (payload: CreateOrderPayload) =>
    api.post<Order>('/orders/', payload).then(r => r.data),
  /**
   * ✅ طلباتي — مرقّمة صفحاتياً (P1): الخادم يرجع { count, next, previous, results }
   */
  myOrders: (page = 1) =>
    api.get<Paginated<Order>>(`/orders/my_orders/`, { params: { page } }).then(r => r.data),
  get: (id: number) => api.get<Order>(`/orders/${id}/`).then(r => r.data),
  cancel: (id: number) => api.post<Order>(`/orders/${id}/cancel/`).then(r => r.data),
  // ✅ الفاتورة الإلكترونية المبسطة (QR بترميز TLV)
  invoice: (id: number) => api.get<InvoiceData>(`/orders/${id}/invoice/`).then(r => r.data),
  // ✅ الدفع الإلكتروني
  initiatePayment: (id: number) =>
    api.post<PaymentSession>(`/orders/${id}/pay/`).then(r => r.data),
  confirmPayment: (id: number, payload: PaymentConfirmPayload) =>
    api.post<{ detail: string; order_number: string; payment_status: string; reference: string }>(
      `/orders/${id}/pay/confirm/`, payload).then(r => r.data),
}

// ============================================================
// ثوابت الأعمال (تُطابق إعدادات الخادم)
// ============================================================
export const BUSINESS = {
  taxRate: 0.15,
  shippingFlat: 25,
  freeShippingThreshold: 500,
  currency: 'ر.س',
} as const

export function calcShipping(subtotal: number): number {
  if (subtotal <= 0) return 0
  return subtotal >= BUSINESS.freeShippingThreshold ? 0 : BUSINESS.shippingFlat
}

export function calcTax(subtotal: number): number {
  return subtotal * BUSINESS.taxRate
}
