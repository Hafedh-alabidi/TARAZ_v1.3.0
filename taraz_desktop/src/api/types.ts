// أنواع بيانات API نظام طراز

export type Role = 'admin' | 'manager' | 'employee' | 'customer'

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'wallet' | 'cod'

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: Role
  role_display?: string
  phone: string
  store_name: string
  address: string
  city: string
  country: string
  is_active: boolean
  created_at: string
}

export interface Category {
  id: number
  name: string
  description: string
  icon: string
  products_count?: number
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  products_count?: number
  created_at: string
}

export interface Product {
  id: number
  name: string
  description: string
  category: number
  category_name: string
  supplier: number | null
  supplier_name: string | null
  price: string
  cost: string
  quantity: number
  min_quantity: number
  sku: string
  barcode: string
  image: string
  /** الصورة الفعلية: ملف مرفوع أو رابط خارجي */
  image_url?: string
  profit_margin: number
  in_stock?: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: number
  product: number
  product_name: string
  product_sku?: string
  quantity: number
  unit_price: string
  subtotal: string
}

export interface Payment {
  id: number
  order: number
  amount: string
  method: PaymentMethod
  method_display?: string
  status: PaymentStatus
  status_display?: string
  transaction_id: string
  notes: string
  created_at: string
}

export interface Commission {
  id: number
  order: number
  amount: string
  percentage: string
  status: 'pending' | 'paid'
  created_at: string
  paid_at: string | null
}

export interface Order {
  id: number
  order_number: string
  customer: number
  customer_name: string
  status: OrderStatus
  status_display?: string
  channel?: 'online' | 'pos'
  channel_display?: string
  total_amount: string
  discount: string
  tax: string
  shipping_fee: string
  final_amount: string
  items: OrderItem[]
  items_count?: number
  payment?: Payment | null
  commission?: Commission | null
  notes: string
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  shipping_city: string
  created_at: string
  updated_at: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface AuthResponse {
  user: User
  token: string
}

export interface DashboardStats {
  generated_at: string
  revenue: {
    today: number
    month: number
    total: number
    /** الإيراد المحصّل فعلياً (دفوعات مكتملة) مقابل قيمة الطلبات */
    collected_total: number
    collected_month: number
    outstanding: number
  }
  orders: { total: number; today: number; pending: number }
  inventory: { products: number; low_stock: number; out_of_stock: number; value: number }
  customers: { total: number }
  sales_by_day: Array<{ date: string; label: string; revenue: number; orders: number }>
  top_products: Array<{ id: number; name: string; sku: string; total_quantity: number; total_sales: number }>
  recent_orders: Order[]
}

export interface OrderStatistics {
  total_orders: number
  pending_orders: number
  confirmed_orders: number
  shipped_orders: number
  delivered_orders: number
  cancelled_orders: number
  total_revenue: string
  today_revenue: string
  month_revenue: string
}

// أشكال إرسال الطلبات
export interface CreateOrderPayload {
  items: Array<{ product_id: number; quantity: number }>
  discount?: number
  notes?: string
  payment_method: PaymentMethod
  /** قناة الطلب — نقطة البيع تُنشئ طلباً مكتمل التسليم فوراً */
  channel?: 'online' | 'pos'
  shipping_name?: string
  shipping_phone?: string
  shipping_address?: string
  shipping_city?: string
  customer_id?: number
}

export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
  password2: string
  first_name?: string
  last_name?: string
  phone?: string
}

// حركات المخزون — سجل التدقيق
export type StockMovementType = 'out' | 'return' | 'in' | 'adjustment'

export interface StockMovement {
  id: number
  product: number
  product_name: string
  product_sku: string
  movement_type: StockMovementType
  movement_type_display: string
  quantity: number
  stock_after: number
  reference: string
  notes: string
  created_by: number | null
  created_by_name: string | null
  created_at: string
}
