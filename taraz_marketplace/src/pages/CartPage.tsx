import { Link } from 'react-router-dom'
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Truck, Lock } from 'lucide-react'
import { useCartStore } from '@/stores/cart'
import { calcShipping, calcTax, BUSINESS } from '@/api/endpoints'
import { EmptyState } from '@/components/ui'
import { toast } from '@/stores/toast'
import { usePageTitle } from '@/hooks/usePageTitle'

const fmt = (n: number) => n.toLocaleString('ar-SA', { maximumFractionDigits: 2 })

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, subtotal } = useCartStore()
  usePageTitle('سلة التسوق — طراز', 'راجع منتجات سلتك وكمياتها وأكمل الدفع بخطوات واضحة.')

  const total = subtotal()
  const shipping = calcShipping(total)
  const tax = calcTax(total)
  const grandTotal = total + shipping + tax
  const freeShippingProgress = Math.min(100, (total / BUSINESS.freeShippingThreshold) * 100)
  const remainingForFreeShipping = Math.max(0, BUSINESS.freeShippingThreshold - total)

  const handleUpdate = (productId: number, quantity: number) => {
    const result = updateQuantity(productId, quantity)
    if (!result.ok) toast.error(result.message)
  }

  if (items.length === 0) {
    return (
      <div className="container-luxe py-10">
        <h1 className="font-display font-semibold text-3xl mb-8 text-ink-950">سلة التسوق</h1>
        <div className="card overflow-hidden">
          <EmptyState
            title="سلتك فارغة"
            subtitle="تصفح المنتجات وأضف ما يعجبك إلى السلة"
          />
          <div className="pb-10 text-center">
            <Link to="/products" className="btn-ink">
              ابدأ التسوق
              <ArrowLeft size={17} />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-luxe py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <h1 className="font-display font-semibold text-3xl text-ink-950 flex items-center gap-3.5">
          سلة التسوق
          <span className="text-sm text-stone-400 font-sans font-medium">({items.length} منتجات)</span>
        </h1>
        <button
          onClick={clearCart}
          className="text-sm text-stone-400 hover:text-red-600 font-medium hover:bg-red-50 px-4 py-2 rounded-lg transition"
        >
          <Trash2 size={14} className="inline ml-1 -mt-0.5" />
          إفراغ السلة
        </button>
      </div>

      {/* شريط تقدم الشحن المجاني — رفيع وأنيق */}
      <div className="card p-5 mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Truck size={17} className="text-gold-600 shrink-0" />
          {remainingForFreeShipping > 0 ? (
            <p className="text-sm text-stone-600">
              أضف <b className="text-ink-900 font-bold">{fmt(remainingForFreeShipping)} ر.س</b> واحصل على{' '}
              <b className="text-brand-700 font-bold">شحن مجاني</b>
            </p>
          ) : (
            <p className="text-sm font-semibold text-brand-700">
              مبروك — حصلت على الشحن المجاني لهذا الطلب
            </p>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-l from-gold-300 to-gold-500 transition-all duration-700 ease-out"
            style={{ width: `${freeShippingProgress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* العناصر */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <div
              key={item.productId}
              className="card p-4 flex items-center gap-4 hover:shadow-luxe transition-shadow group"
            >
              {/* الصورة */}
              <Link
                to={`/products/${item.productId}`}
                className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-stone-100 border border-stone-200/60"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-stone-300">
                    <ShoppingBag size={24} />
                  </span>
                )}
              </Link>

              {/* المعلومات */}
              <div className="flex-1 min-w-0">
                <Link
                  to={`/products/${item.productId}`}
                  className="font-semibold text-stone-800 hover:text-brand-700 transition line-clamp-2"
                >
                  {item.name}
                </Link>
                <p className="text-[11px] text-stone-300 font-mono mt-1" dir="ltr">{item.sku}</p>
                <p className="text-ink-900 font-bold mt-1.5">
                  {fmt(item.price)} <span className="text-[11px] text-stone-400 font-sans font-medium">ر.س</span>
                </p>
              </div>

              {/* الكمية + الحذف */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="flex items-center bg-white border border-stone-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => handleUpdate(item.productId, item.quantity - 1)}
                    className="p-2.5 hover:bg-stone-100 transition"
                    aria-label={`تقليل كمية ${item.name}`}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center font-semibold text-sm tabular-nums">{item.quantity}</span>
                  <button
                    onClick={() => handleUpdate(item.productId, item.quantity + 1)}
                    className="p-2.5 hover:bg-stone-100 transition"
                    aria-label={`زيادة كمية ${item.name}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="text-xs text-stone-400 hover:text-red-600 font-medium inline-flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-md transition"
                  aria-label={`حذف ${item.name}`}
                >
                  <Trash2 size={12} />
                  حذف
                </button>
              </div>

              {/* الإجمالي */}
              <div className="text-left shrink-0 hidden sm:block">
                <p className="text-[11px] text-stone-400 font-medium mb-0.5">الإجمالي</p>
                <p className="font-bold text-ink-900 text-lg tabular-nums">
                  {fmt(item.price * item.quantity)}
                  <span className="text-[10px] text-stone-400 font-sans font-medium mr-1">ر.س</span>
                </p>
              </div>
            </div>
          ))}

          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-stone-500 hover:text-ink-900 font-medium text-sm mt-2 group transition-colors"
          >
            <ArrowLeft size={15} className="rotate-180 group-hover:translate-x-1 transition-transform" />
            متابعة التسوق
          </Link>
        </div>

        {/* الملخص */}
        <aside>
          <div className="card p-6 sticky top-32">
            <h3 className="font-display font-semibold text-lg text-ink-950 mb-5 pb-4 border-b border-stone-100">
              ملخص الطلب
            </h3>
            <dl className="space-y-3.5 text-sm">
              <div className="flex justify-between text-stone-600">
                <dt>المجموع الفرعي</dt>
                <dd className="font-semibold text-ink-900 tabular-nums">{fmt(total)} ر.س</dd>
              </div>
              <div className="flex justify-between text-stone-600">
                <dt>الشحن</dt>
                <dd className={`font-semibold tabular-nums ${shipping === 0 ? 'text-brand-600' : 'text-ink-900'}`}>
                  {shipping === 0 ? 'مجاني' : `${fmt(shipping)} ر.س`}
                </dd>
              </div>
              <div className="flex justify-between text-stone-600">
                <dt>الضريبة العامة على المبيعات ({Math.round(BUSINESS.taxRate * 100)}٪)</dt>
                <dd className="font-semibold text-ink-900 tabular-nums">{fmt(tax)} ر.س</dd>
              </div>
              <div className="pt-4 border-t border-dashed border-stone-200 flex justify-between items-baseline">
                <dt className="font-semibold text-ink-900">الإجمالي</dt>
                <dd className="font-bold font-display text-2xl text-ink-950 tabular-nums">
                  {fmt(grandTotal)}
                  <span className="text-xs text-stone-400 font-sans font-medium mr-1.5">ر.س</span>
                </dd>
              </div>
            </dl>

            <Link to="/checkout" className="btn-ink w-full mt-7 !py-3.5 !text-base">
              متابعة الدفع
              <ArrowLeft size={18} />
            </Link>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400 mt-4">
              <Lock size={12} />
              دفع آمن ومشفّر — فاتورة ضريبية لكل طلب
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
