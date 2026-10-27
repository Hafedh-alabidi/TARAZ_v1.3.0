import { useEffect, useState, useCallback, useMemo } from 'react'
import { Trash2, Plus, Minus, Search, Loader2, CheckCircle, CreditCard, Banknote, X, Package, Receipt, ShoppingCart } from 'lucide-react'
import { productsAPI, ordersAPI, usersAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/stores/toast'
import type { Product, User, Order, PaymentMethod } from '@/api/types'

interface CartLine {
  product: Product
  quantity: number
}

const TAX_RATE = 0.15

export default function POSPage() {
  const user = useAuthStore(s => s.user)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<User[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<number | ''>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [discount, setDiscount] = useState('')
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [receipt, setReceipt] = useState<Order | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, custs] = await Promise.all([
        productsAPI.all({ is_active: true, ordering: 'name' }),
        usersAPI.customers().catch(() => [] as User[]),
      ])
      setProducts(prods)
      setCustomers(custs)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q),
    )
  }, [products, search])

  // إدخال باركود + Enter = إضافة مباشرة
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const q = search.trim()
      if (!q) return
      const exact = products.find(p => p.barcode === q || p.sku.toLowerCase() === q.toLowerCase())
      if (exact) {
        addToCart(exact)
        setSearch('')
      } else if (filtered.length > 0) {
        addToCart(filtered[0])
        setSearch('')
      }
    }
  }

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      toast.error('نفدت الكمية من هذا المنتج')
      return
    }
    setCart(prev => {
      const existing = prev.find(l => l.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast.error(`الكمية المتوفرة ${product.quantity} فقط`)
          return prev
        }
        return prev.map(l =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const updateQty = (productId: number, delta: number) => {
    setCart(prev => prev
      .map(l => {
        if (l.product.id !== productId) return l
        const newQty = l.quantity + delta
        if (newQty > l.product.quantity) {
          toast.error(`الكمية المتوفرة ${l.product.quantity} فقط`)
          return l
        }
        return { ...l, quantity: newQty }
      })
      .filter(l => l.quantity > 0),
    )
  }

  const removeLine = (productId: number) =>
    setCart(prev => prev.filter(l => l.product.id !== productId))

  const subtotal = cart.reduce((s, l) => s + parseFloat(l.product.price) * l.quantity, 0)
  // ✅ أمن مالي: سقف الخصم 50% من قيمة الطلب — الخادم يرفض أي تجاوز
  const MAX_DISCOUNT_RATIO = 0.5
  const discountVal = Math.min(
    parseFloat(discount) || 0, subtotal, subtotal * MAX_DISCOUNT_RATIO)
  const tax = (subtotal - discountVal) * TAX_RATE
  const total = subtotal - discountVal + tax

  const completeSale = async () => {
    if (cart.length === 0) return
    setCompleting(true)
    try {
      // العميل: إما محدد من القائمة أو المستخدم الحالي (بيع نقدي سريع)
      const customerId = selectedCustomer !== '' ? selectedCustomer : undefined
      const order = await ordersAPI.create({
        items: cart.map(l => ({ product_id: l.product.id, quantity: l.quantity })),
        payment_method: paymentMethod,
        channel: 'pos', // بيع حضوري — يُنشأ مكتمل التسليم والدفعة فوراً
        discount: discountVal > 0 ? discountVal : undefined,
        notes: `بيع نقطة بيع — الكاشير: ${user?.username ?? ''}`,
        ...(customerId ? { customer_id: customerId } : {}),
      })
      setReceipt(order)
      setCart([])
      setDiscount('')
      setSelectedCustomer('')
      toast.success(`تمت العملية بنجاح — ${order.order_number}`)
      // تحديث الكميات محلياً
      load()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setCompleting(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-600 text-sm'

  return (
    <div className="p-4 md:p-6 flex flex-col lg:flex-row gap-6 h-full">
      {/* المنتجات */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">نقطة البيع</h1>
          <div className="relative w-full sm:w-80">
            <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="امسح الباركود أو ابحث بالاسم/SKU ثم Enter..."
              className="w-full px-10 py-2.5 border rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
              <Loader2 className="animate-spin" /> جارٍ تحميل المنتجات...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Package size={48} className="mx-auto mb-3 text-gray-300" />
              لا توجد منتجات مطابقة
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(product => {
                const out = product.quantity <= 0
                const inCart = cart.find(l => l.product.id === product.id)?.quantity ?? 0
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={out}
                    className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 border border-transparent transition text-right disabled:opacity-50 disabled:cursor-not-allowed relative group"
                  >
                    {inCart > 0 && (
                      <span className="absolute top-2 left-2 w-6 h-6 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {inCart}
                      </span>
                    )}
                    <p className="font-bold text-gray-800 text-sm leading-snug line-clamp-2 mb-2 min-h-[2.5rem]">
                      {product.name}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-blue-600 text-lg font-bold">
                        {parseFloat(product.price).toLocaleString('ar-SA')}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        out ? 'bg-red-100 text-red-600' :
                        product.quantity <= product.min_quantity ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-600'
                      }`}>
                        {out ? 'نفد' : `${product.quantity}`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-1">{product.sku}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* السلة */}
      <div className="w-full lg:w-96 bg-white rounded-xl shadow-lg flex flex-col shrink-0 lg:max-h-full">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Receipt size={20} className="text-blue-600" />
            فاتورة البيع
          </h2>
        </div>

        {/* العميل + الدفع */}
        <div className="p-4 space-y-3 border-b bg-gray-50">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">العميل (اختياري)</label>
            <select
              value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value === '' ? '' : Number(e.target.value))}
              className={inputCls}
            >
              <option value="">بيع سريع — زبون نقدي</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} ({c.username})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['cash', 'card'] as PaymentMethod[]).map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border-2 transition ${
                  paymentMethod === m ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {m === 'cash' ? <Banknote size={18} /> : <CreditCard size={18} />}
                {m === 'cash' ? 'نقدي' : 'بطاقة'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              خصم (ر.س) — بحد أقصى 50%
            </label>
            <input
              type="number" min="0" step="0.01"
              value={discount}
              onChange={e => setDiscount(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
        </div>

        {/* عناصر السلة */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[140px]">
          {cart.length === 0 && (
            <div className="text-center text-gray-400 py-10">
              <ShoppingCart size={44} className="mx-auto text-gray-300" />
              <p className="text-sm mt-2">السلة فارغة — انقر على منتج لإضافته</p>
            </div>
          )}
          {cart.map(line => (
            <div key={line.product.id} className="flex items-center gap-2 border rounded-lg p-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-800 truncate">{line.product.name}</p>
                <p className="text-xs text-gray-500">
                  {parseFloat(line.product.price).toLocaleString('ar-SA')} × {line.quantity} =
                  <span className="font-bold text-gray-700"> {(parseFloat(line.product.price) * line.quantity).toLocaleString('ar-SA')}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(line.product.id, -1)} className="p-1.5 hover:bg-gray-100 rounded" aria-label="تقليل">
                  <Minus size={14} />
                </button>
                <span className="w-7 text-center font-bold text-sm">{line.quantity}</span>
                <button onClick={() => updateQty(line.product.id, 1)} className="p-1.5 hover:bg-gray-100 rounded" aria-label="زيادة">
                  <Plus size={14} />
                </button>
                <button onClick={() => removeLine(line.product.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" aria-label="حذف">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* الإجماليات */}
        <div className="border-t p-4 space-y-2 bg-gray-50 rounded-b-xl">
          <div className="flex justify-between text-sm text-gray-600">
            <span>المجموع الفرعي</span>
            <span>{subtotal.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
          </div>
          {discountVal > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>الخصم</span>
              <span>- {discountVal.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>الضريبة (15%)</span>
            <span>{tax.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t">
            <span>الإجمالي</span>
            <span className="text-green-600">{total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
          </div>
          <button
            onClick={completeSale}
            disabled={cart.length === 0 || completing}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {completing ? (
              <><Loader2 size={20} className="animate-spin" /> جارٍ إتمام البيع...</>
            ) : (
              <><CheckCircle size={20} /> إتمام البيع ({cart.length} منتجات)</>
            )}
          </button>
        </div>
      </div>

      {/* نافذة الإيصال */}
      {receipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setReceipt(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">تمت العملية بنجاح</h3>
              <p className="text-gray-500 font-mono">{receipt.order_number}</p>
            </div>

            <div className="border rounded-lg divide-y text-sm mb-4">
              {receipt.items.map(item => (
                <div key={item.id} className="flex justify-between p-2.5">
                  <span className="text-gray-700">{item.product_name} ×{item.quantity}</span>
                  <span className="font-medium">{parseFloat(item.subtotal).toLocaleString('ar-SA')}</span>
                </div>
              ))}
              <div className="flex justify-between p-2.5 bg-gray-50 font-bold">
                <span>الإجمالي</span>
                <span className="text-green-600">{parseFloat(receipt.final_amount).toLocaleString('ar-SA')} ر.س</span>
              </div>
            </div>

            <button
              onClick={() => setReceipt(null)}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
