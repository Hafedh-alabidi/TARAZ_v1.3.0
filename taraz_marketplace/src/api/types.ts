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

export interface ProductGalleryImage {
  id: number
  image: string
  alt: string
  sort_order: number
}

export interface Product {
  id: number
  name: string
  description: string
  category: number
  category_name: string
  price: string
  /** ✅ سعر ما قبل الخصم — لعرضه مشطوباً عند وجود تخفيض */
  compare_at_price?: string | null
  discount_percent?: number | null
  sku: string
  image: string
  /** ✅ الصورة الفعلية: الملف المرفوع خادمياً أو الرابط الخارجي */
  image_url?: string
  /** ✅ معرض صور المنتج (قد يكون فارغاً) */
  images?: ProductGalleryImage[]
  in_stock?: boolean
  availability?: 'in_stock' | 'low_stock' | 'out_of_stock'
  is_active: boolean
  created_at: string
  // ✅ حقول داخلية تظهر لموظفي النظام فقط (قد تكون غائبة للمتجر العام)
  supplier?: number | null
  supplier_name?: string | null
  cost?: string
  quantity?: number
  min_quantity?: number
  barcode?: string
  profit_margin?: number
  updated_at?: string
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
  /** ✅ الإيرادات المحصّلة فعلياً مقابل قيمة الطلبات (P1) */
  collected_revenue: string
  collected_today: string
  collected_month: string
  outstanding_revenue: string
}

// أشكال إرسال الطلبات
// الحد الأقصى للكمية التي يحددها العميل في الواجهة —
// الكمية الفعلية المتاحة يتحقق منها الخادم دائماً (لا تُنشر للعملاء)
export const MAX_CART_QTY_PER_PRODUCT = 20

export interface CreateOrderPayload {
  items: Array<{ product_id: number; quantity: number }>
  notes?: string
  payment_method: PaymentMethod
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

// ============================================================
// ✅ إعدادات الأعمال العامة (من /api/config/) — بلا أسرار
// ============================================================
export interface AppConfig {
  store_name: string
  currency: string
  tax_rate: number
  free_shipping_threshold: number
  payment: {
    provider: 'moyasar' | 'simulated' | 'none'
    simulated: boolean
    card_enabled: boolean
    label: string
  }
  support: {
    email: string
    phone: string
    hours: string
  }
}

// ============================================================
// ✅ الفاتورة الإلكترونية المبسطة (QR بترميز TLV)
// ============================================================
export interface InvoiceData {
  invoice_number: string
  order_number: string
  channel: string
  channel_display: string
  status: string
  status_display: string
  issued_at: string
  seller: { name: string; vat_number: string }
  customer: { name: string; phone: string; address: string }
  items: Array<{
    name: string
    sku: string
    quantity: number
    unit_price: string
    subtotal: string
  }>
  totals: {
    subtotal: string
    discount: string
    tax: string
    tax_rate: number
    shipping_fee: string
    final_amount: string
  }
  payment: {
    method: string
    method_display: string
    status: string
    status_display: string
    transaction_id: string
  } | null
  zatca: {
    tlv_base64: string
    qr_png: string
    timestamp: string
    spec: string
  }
}

// ============================================================
// ✅ الدفع الإلكتروني (بوابة مويسر / وضع المحاكاة)
// ============================================================
export interface PaymentSession {
  order: number
  order_number: string
  amount: string
  currency: string
  provider: string
  mode: string
  session_id: string
  payment_url?: string
  test_cards?: Array<{ number: string; result: string; label: string }>
}

export interface PaymentConfirmPayload {
  session_id: string
  card_number: string
  card_expiry: string
  card_cvv: string
  card_name: string
}
