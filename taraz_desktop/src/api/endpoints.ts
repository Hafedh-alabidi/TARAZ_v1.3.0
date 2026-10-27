import { api } from './client'
import type {
  AuthResponse, Category, Commission, CreateOrderPayload, DashboardStats,
  LoginPayload, Order, OrderStatistics, Paginated, Payment, Product,
  RegisterPayload, StockMovement, Supplier, User,
} from './types'

/** استخراج قائمة من استجابة قد تكون مصفوفة أو مرقّمة صفحات */
function unwrapList<T>(data: T[] | Paginated<T>): T[] {
  if (Array.isArray(data)) return data
  return data.results ?? []
}

// ============================================================
// المصادقة
// ============================================================
export const authAPI = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login/', payload).then(r => r.data),
  logout: () => api.post('/auth/logout/').then(r => r.data),
  me: () => api.get<User>('/users/me/').then(r => r.data),
}

// ============================================================
// المنتجات
// ============================================================
export interface ProductQuery {
  search?: string
  category?: number
  is_active?: boolean
  low_stock?: boolean
  ordering?: string
  page?: number
  page_size?: number
}

export interface ProductPayload {
  name: string
  description?: string
  category: number
  supplier?: number | null
  price: number
  cost?: number
  quantity?: number
  min_quantity?: number
  sku: string
  barcode?: string
  image?: string
  is_active?: boolean
}

export const productsAPI = {
  list: (params?: ProductQuery) =>
    api.get<Paginated<Product>>('/products/', { params }).then(r => r.data),
  all: async (params?: ProductQuery) => {
    // جلب كل الصفحات (لنقطة البيع والجداول)
    const first = await api.get<Paginated<Product>>('/products/', {
      params: { ...params, page_size: 100 },
    }).then(r => r.data)
    let results = [...first.results]
    let next = first.next
    let guard = 0
    while (next && guard < 20) {
      const url = new URL(next)
      const page = url.searchParams.get('page')
      const res = await api.get<Paginated<Product>>('/products/', {
        params: { ...params, page_size: 100, page: page ?? undefined },
      }).then(r => r.data)
      results = [...results, ...res.results]
      next = res.next
      guard++
    }
    return results
  },
  get: (id: number) => api.get<Product>(`/products/${id}/`).then(r => r.data),
  create: (payload: ProductPayload) =>
    api.post<Product>('/products/', payload).then(r => r.data),
  update: (id: number, payload: Partial<ProductPayload>) =>
    api.patch<Product>(`/products/${id}/`, payload).then(r => r.data),
  remove: (id: number) => api.delete(`/products/${id}/`).then(r => r.data),
  lowStock: () => api.get<Product[]>('/products/low_stock/').then(r => r.data),
  outOfStock: () => api.get<Product[]>('/products/out_of_stock/').then(r => r.data),
  updateQuantity: (id: number, payload: { quantity?: number; delta?: number }) =>
    api.post<{ status: string; quantity: number }>(`/products/${id}/update_quantity/`, payload).then(r => r.data),
  restock: (id: number, amount: number) =>
    api.post<{ status: string; quantity: number }>(`/products/${id}/restock/`, { amount }).then(r => r.data),
  search: (q: string) => api.get<Product[]>('/products/search/', { params: { q } }).then(r => r.data),
  // ✅ P1 رفع صور المنتجات مباشرة (multipart)
  uploadImage: (id: number, file: File) => {
    const form = new FormData()
    form.append('image', file)
    return api.post<{ status: string; image_url: string }>(
      `/products/${id}/upload-image/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data)
  },
}

// ============================================================
// الفئات والموردون
// ============================================================
export const categoriesAPI = {
  list: () =>
    api.get<Category[] | Paginated<Category>>('/categories/')
      .then(r => unwrapList(r.data)),
  create: (payload: { name: string; description?: string; icon?: string }) =>
    api.post<Category>('/categories/', payload).then(r => r.data),
  update: (id: number, payload: Partial<{ name: string; description: string; icon: string }>) =>
    api.patch<Category>(`/categories/${id}/`, payload).then(r => r.data),
  remove: (id: number) => api.delete(`/categories/${id}/`).then(r => r.data),
}

export const suppliersAPI = {
  list: (params?: { search?: string }) =>
    api.get<Supplier[] | Paginated<Supplier>>('/suppliers/', { params })
      .then(r => unwrapList(r.data)),
  create: (payload: Partial<Supplier>) =>
    api.post<Supplier>('/suppliers/', payload).then(r => r.data),
  update: (id: number, payload: Partial<Supplier>) =>
    api.patch<Supplier>(`/suppliers/${id}/`, payload).then(r => r.data),
  remove: (id: number) => api.delete(`/suppliers/${id}/`).then(r => r.data),
}

// ============================================================
// الطلبات والدفعات والعمولات
// ============================================================
export const ordersAPI = {
  list: (params?: { status?: string; customer?: number; page?: number; page_size?: number }) =>
    api.get<Paginated<Order>>('/orders/', { params }).then(r => r.data),
  get: (id: number) => api.get<Order>(`/orders/${id}/`).then(r => r.data),
  create: (payload: CreateOrderPayload) =>
    api.post<Order>('/orders/', payload).then(r => r.data),
  confirm: (id: number) => api.post<Order>(`/orders/${id}/confirm/`).then(r => r.data),
  ship: (id: number) => api.post<Order>(`/orders/${id}/ship/`).then(r => r.data),
  deliver: (id: number) => api.post<Order>(`/orders/${id}/deliver/`).then(r => r.data),
  cancel: (id: number) => api.post<Order>(`/orders/${id}/cancel/`).then(r => r.data),
  statistics: () => api.get<OrderStatistics>('/orders/statistics/').then(r => r.data),
}

export const paymentsAPI = {
  list: (params?: { status?: string; method?: string }) =>
    api.get<Paginated<Payment>>('/payments/', { params }).then(r => r.data),
  complete: (id: number) => api.post<Payment>(`/payments/${id}/complete/`).then(r => r.data),
  refund: (id: number) => api.post<Payment>(`/payments/${id}/refund/`).then(r => r.data),
}

export const commissionsAPI = {
  list: (params?: { status?: string }) =>
    api.get<Paginated<Commission>>('/commissions/', { params }).then(r => r.data),
  summary: () =>
    api.get<{ total: string; paid: string; pending: string }>('/commissions/summary/').then(r => r.data),
  markPaid: (id: number) => api.post<Commission>(`/commissions/${id}/mark_paid/`).then(r => r.data),
}

// ============================================================
// المستخدمون / العملاء
// ============================================================
export const usersAPI = {
  list: (params?: { role?: string; search?: string }) =>
    api.get<Paginated<User>>('/users/', { params }).then(r => r.data),
  customers: () => api.get<User[]>('/users/customers/').then(r => r.data),
  create: (payload: RegisterPayload & { role?: string; phone?: string }) =>
    api.post<User>('/users/', payload).then(r => r.data),
  update: (id: number, payload: Partial<User> & { password?: string }) =>
    api.patch<User>(`/users/${id}/`, payload).then(r => r.data),
  toggleActive: (id: number, isActive: boolean) =>
    api.patch<User>(`/users/${id}/`, { is_active: isActive }).then(r => r.data),
}

// ============================================================
// لوحة التحكم
// ============================================================
export const dashboardAPI = {
  stats: () => api.get<DashboardStats>('/dashboard/stats/').then(r => r.data),
}

// ============================================================
// حركات المخزون — سجل التدقيق
// ============================================================
export const stockMovementsAPI = {
  list: (params?: { product?: number; movement_type?: string; page_size?: number }) =>
    api.get<Paginated<StockMovement>>('/stock-movements/', { params }).then(r => r.data),
  productHistory: (productId: number) =>
    api.get<StockMovement[]>(`/stock-movements/product_history/?product_id=${productId}`).then(r => r.data),
}
