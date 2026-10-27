import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle, Banknote, Landmark, Truck, ShieldCheck, CreditCard, Receipt,
  ArrowRight, Lock, Check,
} from 'lucide-react'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useConfigStore } from '@/stores/config'
import { ordersAPI, calcShipping, calcTax } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { toast } from '@/stores/toast'
import { EmptyState } from '@/components/ui'
import { usePageTitle } from '@/hooks/usePageTitle'
import InvoiceView from '@/components/InvoiceView'
import PaymentModal from '@/components/PaymentModal'
import type { PaymentMethod, Order, PaymentSession } from '@/api/types'

// ✅ صدق الدفع: خيارات الدفع تُبنى ديناميكياً حسب ما هو مفعل فعلاً على
// الخادم (عبر /api/config/) — لا عرض لوسيلة دفع غير مفعلة، ولا إخفاء
// لمفعل منها. الدفع بالبطاقة يُنفذ فعلياً عبر بوابة الدفع (مويسر أو محاكاة).
export default function CheckoutPage() {
  const { items, clearCart, subtotal } = useCartStore()
  const user = useAuthStore(s => s.user)
  const config = useConfigStore(s => s.config)
  usePageTitle('إتمام الشراء — طراز', 'أكمل طلبك بخطوات واضحة: الشحن ثم الدفع ثم المراجعة.')

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null)
  const [showInvoice, setShowInvoice] = useState(false)
  const [paySession, setPaySession] = useState<PaymentSession | null>(null)

  // بيانات الشحن — تُملأ مسبقاً من ملف المستخدم
  const [shipping, setShipping] = useState({
    name: user ? `${user.first_name} ${user.last_name}`.trim() || user.username : '',
    phone: user?.phone ?? '',
    address: user?.address ?? '',
    city: user?.city ?? '',
  })
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod')

  const total = subtotal()
  const shippingFee = calcShipping(total)
  const tax = calcTax(total)
  const grandTotal = total + shippingFee + tax

  // خيارات الدفع — حسب الواقع المفعل على الخادم
  const cardEnabled = config?.payment.card_enabled ?? false
  const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string; desc: string; icon: React.ReactNode }> = [
    ...(cardEnabled ? [{
      value: 'card' as PaymentMethod,
      label: 'جيب / بطاقة ائتمانية',
      desc: config?.payment.simulated
        ? 'دفع تجريبي فوري — وضع المعاينة (لا يُخصم مبلغ حقيقي)'
        : 'دفع آمن فوري عبر بوابة الدفع — جيب / Visa / Mastercard',
      icon: <CreditCard size={22} />,
    }] : []),
    { value: 'cod', label: 'الدفع عند الاستلام', desc: 'ادفع نقداً عند وصول طلبك', icon: <Banknote size={22} /> },
    { value: 'transfer', label: 'تحويل بنكي', desc: 'يُؤكد الطلب بعد وصول التحويل', icon: <Landmark size={22} /> },
  ]

  const steps = ['عنوان الشحن', 'طريقة الدفع', 'مراجعة الطلب']
  const stepFieldsValid =
    shipping.name.trim().length >= 2 &&
    shipping.phone.trim().length >= 9 &&
    shipping.address.trim().length >= 5 &&
    shipping.city.trim().length >= 2

  const submitOrder = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const order = await ordersAPI.create({
        items: items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        payment_method: paymentMethod,
        shipping_name: shipping.name.trim(),
        shipping_phone: shipping.phone.trim(),
        shipping_address: shipping.address.trim(),
        shipping_city: shipping.city.trim(),
        notes: '',
      })
      setPlacedOrder(order)
      clearCart()
      toast.success(`تم استلام طلبك ${order.order_number} بنجاح!`)

      // ✅ الدفع بالبطاقة: إنشاء جلسة دفع فورية بعد الطلب
      if (paymentMethod === 'card' && cardEnabled) {
        try {
          const session = await ordersAPI.initiatePayment(order.id)
          setPaySession(session)
        } catch (err) {
          // الطلب أُنشئ رغم تعذر فتح الدفع — يبقى دفعاً معلقاً قابل
          // للدفع لاحقاً من «طلباتي»
          toast.error(extractErrorMessage(err))
        }
      }
    } catch (err) {
      const msg = extractErrorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePaid = (reference: string) => {
    setPaySession(null)
    if (placedOrder) {
      setPlacedOrder({
        ...placedOrder,
        status: 'confirmed',
        payment: placedOrder.payment
          ? { ...placedOrder.payment, status: 'completed', status_display: 'مكتمل' }
          : placedOrder.payment,
      })
    }
    toast.success(`تم الدفع بنجاح — مرجع العملية ${reference}`)
  }

  // شاشة نجاح الطلب
  if (placedOrder) {
    return (
      <div className="container-luxe py-14 max-w-2xl">
        {paySession && (
          <PaymentModal
            session={paySession}
            onClose={() => setPaySession(null)}
            onPaid={handlePaid}
          />
        )}
        <div className="card overflow-hidden text-center">
          {/* رأس تهنئة هادئ */}
          <div className="relative bg-ink-950 text-white py-12 px-8 overflow-hidden">
            <div className="absolute inset-0 pattern-diamond pointer-events-none" />
            <div className="absolute -top-20 right-1/3 w-72 h-72 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-brand-800/40 border border-brand-600/40 flex items-center justify-center">
                <Check size={30} className="text-brand-300" strokeWidth={2.2} />
              </div>
              <h1 className="font-display font-semibold text-3xl mb-2">تم استلام طلبك بنجاح</h1>
              <p className="text-stone-400 text-sm">
                رقم الطلب:{' '}
                <span className="font-semibold font-mono text-gold-300" dir="ltr">
                  {placedOrder.order_number}
                </span>
              </p>
            </div>
          </div>

          <div className="p-8">
            <div className="bg-stone-50 border border-stone-200/70 rounded-2xl p-6 text-right space-y-3.5 mb-8">
              <div className="flex justify-between text-stone-600 text-sm">
                <span>الإجمالي النهائي</span>
                <span className="font-black font-display text-brand-700 text-lg tabular-nums">
                  {parseFloat(placedOrder.final_amount).toLocaleString('ar-SA')} ر.س
                </span>
              </div>
              <div className="flex justify-between text-stone-600 text-sm">
                <span>طريقة الدفع</span>
                <span className="font-bold text-stone-800">{placedOrder.payment?.method_display}</span>
              </div>
              <div className="flex justify-between text-stone-600 text-sm">
                <span>الحالة</span>
                <span className="font-bold text-amber-600">{placedOrder.status_display}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => setShowInvoice(!showInvoice)} className="btn-ink">
                <Receipt size={17} />
                {showInvoice ? 'إخفاء الفاتورة' : 'عرض الفاتورة الضريبية'}
              </button>
              <Link to="/orders" className="btn-outline">
                تتبع طلباتي
              </Link>
            </div>

            {showInvoice && (
              <div className="mt-8 text-right animate-fade-in">
                <InvoiceView orderId={placedOrder.id} compact />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container-luxe py-10 max-w-3xl">
        <div className="card overflow-hidden">
          <EmptyState title="لا يمكن إتمام الشراء" subtitle="سلتك فارغة — أضف منتجات أولاً" />
          <div className="pb-10 text-center">
            <Link to="/products" className="btn-primary">تصفح المنتجات</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-luxe py-10">
      <div className="mb-10">
        <span className="eyebrow mb-2">خطوة أخيرة</span>
        <h1 className="text-3xl font-black font-display text-stone-900">إتمام الشراء</h1>
      </div>

      {/* شريط الخطوات — نظيف بلا صناديق */}
      <div className="flex items-center justify-center mb-10" aria-label="مراحل إتمام الشراء">
        {steps.map((label, i) => {
          const done = step > i + 1
          const active = step === i + 1
          return (
            <div key={label} className="flex items-center">
              <div className={`flex items-center gap-2.5 ${done ? 'text-brand-600' : active ? 'text-ink-900' : 'text-stone-400'}`}>
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-[13px] border transition-all ${
                    done
                      ? 'bg-brand-700 text-white border-transparent'
                      : active
                        ? 'bg-ink-900 text-white border-transparent'
                        : 'border-stone-300 bg-white'
                  }`}
                >
                  {done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                </span>
                <span className={`text-sm font-semibold hidden sm:inline ${!active && !done ? 'font-normal text-stone-400' : ''}`}>{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 sm:w-16 h-px mx-3 transition-colors ${
                  step > i + 1 ? 'bg-brand-500' : 'bg-stone-200'
                }`} />
              )}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* الخطوة 1: الشحن */}
          {step === 1 && (
            <div className="card p-7 animate-fade-in">
              <h2 className="text-xl font-bold font-display mb-6 flex items-center gap-2.5 text-stone-900">
                <span className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                  <Truck size={20} className="text-brand-700" />
                </span>
                عنوان الشحن
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-stone-700 mb-2">الاسم الكامل *</label>
                  <input
                    type="text" value={shipping.name}
                    onChange={e => setShipping(s => ({ ...s, name: e.target.value }))}
                    className="input-luxe"
                    placeholder="مثال: أحمد المطيري"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">رقم الهاتف *</label>
                  <input
                    type="tel" value={shipping.phone} dir="ltr"
                    onChange={e => setShipping(s => ({ ...s, phone: e.target.value }))}
                    className="input-luxe text-left"
                    placeholder="05xxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">المدينة *</label>
                  <input
                    type="text" value={shipping.city}
                    onChange={e => setShipping(s => ({ ...s, city: e.target.value }))}
                    className="input-luxe"
                    placeholder="صنعاء"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-stone-700 mb-2">العنوان التفصيلي *</label>
                  <textarea
                    value={shipping.address} rows={3}
                    onChange={e => setShipping(s => ({ ...s, address: e.target.value }))}
                    className="input-luxe resize-none"
                    placeholder="الحي، الشارع، رقم المبنى..."
                  />
                </div>
              </div>

              {!stepFieldsValid && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3.5 mt-5">
                  يرجى إكمال جميع الحقول المطلوبة للمتابعة
                </p>
              )}

              <button
                onClick={() => setStep(2)}
                disabled={!stepFieldsValid}
                className="btn-primary mt-6"
              >
                التالي
                <ArrowRight size={17} className="rotate-180" />
              </button>
            </div>
          )}

          {/* الخطوة 2: الدفع */}
          {step === 2 && (
            <div className="card p-7 animate-fade-in">
              <h2 className="text-xl font-bold font-display mb-2 flex items-center gap-2.5 text-stone-900">
                <span className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                  <ShieldCheck size={20} className="text-brand-700" />
                </span>
                طريقة الدفع
              </h2>
              <p className="text-sm text-stone-500 mb-6">
                {cardEnabled
                  ? 'اختر طريقة الدفع المناسبة — الدفع بالبطاقة فوري ومؤكد تلقائياً.'
                  : 'طرق الدفع الحالية مؤكدة وموثوقة — الدفع الإلكتروني بالبطاقة سيتوفر قريباً.'}
              </p>
              <div className="space-y-3.5">
                {PAYMENT_OPTIONS.map(opt => {
                  const selected = paymentMethod === opt.value
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-4 p-4 border-2 rounded-2xl cursor-pointer transition-all ${
                        selected
                          ? 'border-brand-600 bg-brand-50/60 shadow-soft'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={selected}
                        onChange={() => setPaymentMethod(opt.value)}
                        className="accent-brand-600 w-4 h-4"
                        aria-label={opt.label}
                      />
                      <span className={`p-2.5 rounded-xl transition-colors ${
                        selected ? 'bg-brand-600 text-white' : 'bg-stone-100 text-brand-600'
                      }`}>
                        {opt.icon}
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-stone-800">{opt.label}</p>
                        <p className="text-[13px] text-stone-500 mt-0.5">{opt.desc}</p>
                      </div>
                      {selected && <CheckCircle size={20} className="text-brand-600 shrink-0" />}
                    </label>
                  )
                })}
              </div>

              <div className="flex gap-3 mt-7">
                <button
                  onClick={() => setStep(1)}
                  className="btn-outline"
                >
                  <ArrowRight size={16} />
                  السابق
                </button>
                <button onClick={() => setStep(3)} className="btn-primary">
                  التالي
                  <ArrowRight size={17} className="rotate-180" />
                </button>
              </div>
            </div>
          )}

          {/* الخطوة 3: المراجعة */}
          {step === 3 && (
            <div className="card p-7 animate-fade-in">
              <h2 className="text-xl font-bold font-display mb-6 text-stone-900">مراجعة الطلب</h2>

              <div className="space-y-4 mb-6">
                <div className="bg-stone-50 border border-stone-200/70 rounded-2xl p-5">
                  <h3 className="font-bold text-sm text-stone-700 mb-2.5 flex items-center gap-2">
                    <Truck size={16} className="text-brand-600" /> عنوان الشحن
                    <button onClick={() => setStep(1)} className="mr-auto text-brand-600 text-xs font-bold hover:text-brand-800 hover:underline">
                      تعديل
                    </button>
                  </h3>
                  <p className="text-stone-800 font-semibold">{shipping.name} — <span dir="ltr">{shipping.phone}</span></p>
                  <p className="text-stone-500 text-sm mt-1">{shipping.address}، {shipping.city}</p>
                </div>

                <div className="bg-stone-50 border border-stone-200/70 rounded-2xl p-5">
                  <h3 className="font-bold text-sm text-stone-700 mb-2.5 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-brand-600" /> طريقة الدفع
                    <button onClick={() => setStep(2)} className="mr-auto text-brand-600 text-xs font-bold hover:text-brand-800 hover:underline">
                      تعديل
                    </button>
                  </h3>
                  <p className="text-stone-800 font-semibold">
                    {PAYMENT_OPTIONS.find(p => p.value === paymentMethod)?.label}
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-stone-700 mb-2.5">المنتجات ({items.length})</h3>
                  <div className="divide-y divide-stone-100 border border-stone-200/70 rounded-2xl overflow-hidden bg-white">
                    {items.map(item => (
                      <div key={item.productId} className="flex justify-between items-center p-4 text-sm">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/70 flex items-center justify-center">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={e => (e.currentTarget.style.display = 'none')}
                              />
                            ) : (
                              <span className="text-stone-300">📦</span>
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-stone-800 truncate">{item.name}</p>
                            <p className="text-stone-400 text-xs mt-0.5 tabular-nums">
                              {item.quantity} × {item.price.toLocaleString('ar-SA')} ر.س
                            </p>
                          </div>
                        </div>
                        <span className="font-black text-stone-800 tabular-nums shrink-0">
                          {(item.price * item.quantity).toLocaleString('ar-SA')} ر.س
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5 text-sm font-medium">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  disabled={submitting}
                  className="btn-outline"
                >
                  <ArrowRight size={16} />
                  السابق
                </button>
                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="btn-ink !py-3.5 !text-base"
                >
                  {submitting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      جارٍ إرسال الطلب...
                    </>
                  ) : (
                    <>
                      <Lock size={17} />
                      تأكيد الطلب
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* الملخص */}
        <aside>
          <div className="card p-6 lg:sticky lg:top-32">
            <h2 className="font-display font-bold text-lg text-stone-900 mb-5 pb-4 border-b border-stone-100">
              ملخص الطلب
            </h2>
            <div className="space-y-3.5 mb-6 pb-6 border-b border-dashed border-stone-200 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>المجموع الفرعي</span>
                <span className="font-bold text-stone-800 tabular-nums">
                  {total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>الشحن</span>
                {shippingFee === 0
                  ? <span className="text-brand-600 font-bold">مجاني</span>
                  : <span className="font-bold text-stone-800 tabular-nums">{shippingFee.toLocaleString('ar-SA')} ر.س</span>}
              </div>
              <div className="flex justify-between text-stone-600">
                <span>الضريبة (15%)</span>
                <span className="font-bold text-stone-800 tabular-nums">
                  {tax.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                </span>
              </div>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-stone-800">الإجمالي</span>
              <span className="font-black font-display text-2xl text-brand-700 tabular-nums">
                {grandTotal.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                <span className="text-xs text-stone-400 font-sans font-semibold mr-1.5">ر.س</span>
              </span>
            </div>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400 mt-6">
              <Lock size={12} />
              معاملة آمنة — فاتورة ضريبية إلكترونية فور التأكيد
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
