import { useEffect, useState, useCallback } from 'react'
import {
  Package, Clock, CheckCircle, Truck, XCircle, ChevronDown, Receipt, CreditCard,
} from 'lucide-react'
import { ordersAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useConfigStore } from '@/stores/config'
import { PageLoader, EmptyState, ErrorState } from '@/components/ui'
import InvoiceView from '@/components/InvoiceView'
import PaymentModal from '@/components/PaymentModal'
import { toast } from '@/stores/toast'
import type { Order, OrderStatus, PaymentSession } from '@/api/types'
import { Link } from 'react-router-dom'

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string; dot: string; icon: React.ReactNode }> = {
  pending: {
    label: 'قيد الانتظار', className: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400', icon: <Clock size={14} />,
  },
  confirmed: {
    label: 'مؤكد', className: 'bg-brand-50 text-brand-700 border-brand-200',
    dot: 'bg-brand-500', icon: <CheckCircle size={14} />,
  },
  shipped: {
    label: 'تم الشحن', className: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500', icon: <Truck size={14} />,
  },
  delivered: {
    label: 'تم التسليم', className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500', icon: <Package size={14} />,
  },
  cancelled: {
    label: 'ملغي', className: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500', icon: <XCircle size={14} />,
  },
}

export default function OrdersPage() {
  const user = useAuthStore(s => s.user)
  const config = useConfigStore(s => s.config)
  const [orders, setOrders] = useState<Order[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [invoiceOrderId, setInvoiceOrderId] = useState<number | null>(null)
  const [paySession, setPaySession] = useState<PaymentSession | null>(null)
  const [payingId, setPayingId] = useState<number | null>(null)

  useEffect(() => {
    ordersAPI.myOrders(1)
      .then(res => {
        setOrders(res.results)
        setCount(res.count)
        setHasMore(Boolean(res.next))
      })
      .catch(err => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  // ✅ تحميل المزيد (ترقيم صفحاتياً من الخادم)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const res = await ordersAPI.myOrders(page + 1)
      setOrders(prev => [...prev, ...res.results])
      setPage(p => p + 1)
      setHasMore(Boolean(res.next))
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, page])

  const handleCancel = async (orderId: number) => {
    try {
      await ordersAPI.cancel(orderId)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' as OrderStatus } : o))
      toast.success('تم إلغاء الطلب وإرجاع الكميات للمخزون')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  // ✅ فتح جلسة دفع لطلب معلق غير مدفوع (بطاقة)
  const handlePayNow = async (orderId: number) => {
    setPayingId(orderId)
    try {
      const session = await ordersAPI.initiatePayment(orderId)
      setPaySession(session)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setPayingId(null)
    }
  }

  const handlePaid = () => {
    const orderId = paySession?.order
    setPaySession(null)
    if (orderId) {
      setOrders(prev => prev.map(o => o.id === orderId
        ? {
            ...o, status: 'confirmed' as OrderStatus,
            payment: o.payment ? { ...o.payment, status: 'completed', status_display: 'مكتمل' } : o.payment,
          }
        : o))
    }
    toast.success('تم الدفع بنجاح — يمكنك عرض الفاتورة الآن')
  }

  if (loading) return <PageLoader label="جارٍ تحميل طلباتك..." />

  const cardEnabled = config?.payment.card_enabled ?? false

  return (
    <div className="container-luxe py-10 max-w-5xl">
      {paySession && (
        <PaymentModal
          session={paySession}
          onClose={() => setPaySession(null)}
          onPaid={handlePaid}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <span className="eyebrow mb-2">سجل مشترياتك</span>
          <h1 className="text-3xl font-black font-display text-stone-900">طلباتي</h1>
        </div>
        {user && (
          <p className="text-stone-500 text-sm bg-white border border-stone-200/70 rounded-full px-4 py-2 shadow-soft">
            مرحباً <b className="text-brand-700">{user.first_name || user.username}</b> — لديك{' '}
            <b className="text-brand-700">{count.toLocaleString('ar-SA')}</b> طلباً
          </p>
        )}
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : orders.length === 0 ? (
        <div className="card overflow-hidden">
          <EmptyState title="لا توجد طلبات بعد" subtitle="ابدأ التسوق واستمتع بتجربة طراز" />
          <div className="pb-10 text-center">
            <Link to="/products" className="btn-primary">
              تصفح المنتجات
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((order, idx) => {
              const status = STATUS_CONFIG[order.status]
              const isExpanded = expandedId === order.id
              return (
                <div
                  key={order.id}
                  className={`card overflow-hidden animate-fade-up stagger-${Math.min((idx % 6) + 1, 6)}`}
                >
                  {/* رأس البطاقة */}
                  <div
                    className="p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-brand-50/40 transition group"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpandedId(isExpanded ? null : order.id) }}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border shrink-0 ${status.className}`}>
                        {status.icon}
                        {status.label}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-stone-800 font-mono text-sm" dir="ltr">
                          {order.order_number}
                        </p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {new Date(order.created_at).toLocaleDateString('ar-SA', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5">
                      <div className="text-left">
                        <p className="text-[11px] text-stone-400 font-medium">{order.items.length} منتجات</p>
                        <p className="font-black font-display text-brand-700 text-lg leading-tight tabular-nums">
                          {parseFloat(order.final_amount).toLocaleString('ar-SA')}
                          <span className="text-[10px] text-stone-400 font-sans font-semibold mr-1">ر.س</span>
                        </p>
                      </div>
                      <span
                        className={`w-9 h-9 rounded-xl border border-stone-200 bg-white flex items-center justify-center text-stone-400 group-hover:text-brand-600 group-hover:border-brand-300 transition ${
                          isExpanded ? 'rotate-180 text-brand-600' : ''
                        }`}
                      >
                        <ChevronDown size={17} />
                      </span>
                    </div>
                  </div>

                  {/* التفاصيل الموسعة */}
                  {isExpanded && (
                    <div className="border-t border-stone-100 bg-stone-50/60 p-5 animate-scale-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* المنتجات */}
                        <div>
                          <h3 className="font-bold text-stone-800 text-sm mb-3 flex items-center gap-2">
                            <Package size={15} className="text-brand-600" />
                            المنتجات
                          </h3>
                          <div className="space-y-2">
                            {order.items.map(item => (
                              <div key={item.id} className="flex justify-between text-sm bg-white rounded-xl p-3 border border-stone-200/60">
                                <div>
                                  <Link to={`/products/${item.product}`} className="font-semibold text-stone-800 hover:text-brand-700 transition">
                                    {item.product_name}
                                  </Link>
                                  <p className="text-stone-400 text-xs mt-0.5 tabular-nums">
                                    {item.quantity} × {parseFloat(item.unit_price).toLocaleString('ar-SA')} ر.س
                                  </p>
                                </div>
                                <span className="font-bold text-stone-700 tabular-nums">
                                  {parseFloat(item.subtotal).toLocaleString('ar-SA')} ر.س
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* التفاصيل المالية */}
                        <div>
                          <h3 className="font-bold text-stone-800 text-sm mb-3 flex items-center gap-2">
                            <Receipt size={15} className="text-brand-600" />
                            تفاصيل الفاتورة
                          </h3>
                          <div className="bg-white rounded-xl p-4 border border-stone-200/60 space-y-2.5 text-sm">
                            <div className="flex justify-between text-stone-500">
                              <span>المجموع الفرعي</span>
                              <span className="font-semibold text-stone-700 tabular-nums">
                                {parseFloat(order.total_amount).toLocaleString('ar-SA')} ر.س
                              </span>
                            </div>
                            <div className="flex justify-between text-stone-500">
                              <span>الشحن</span>
                              <span className="font-semibold text-stone-700 tabular-nums">
                                {order.shipping_fee === '0.00'
                                  ? 'مجاني'
                                  : parseFloat(order.shipping_fee).toLocaleString('ar-SA') + ' ر.س'}
                              </span>
                            </div>
                            <div className="flex justify-between text-stone-500">
                              <span>الضريبة</span>
                              <span className="font-semibold text-stone-700 tabular-nums">
                                {parseFloat(order.tax).toLocaleString('ar-SA')} ر.س
                              </span>
                            </div>
                            <div className="flex justify-between font-black text-stone-800 border-t border-dashed border-stone-200 pt-2.5">
                              <span>الإجمالي</span>
                              <span className="text-brand-700 font-display text-base tabular-nums">
                                {parseFloat(order.final_amount).toLocaleString('ar-SA')} ر.س
                              </span>
                            </div>
                            {order.payment && (
                              <div className="flex justify-between text-stone-500 pt-1">
                                <span>الدفع ({order.payment.method_display})</span>
                                <span className={`font-bold ${
                                  order.payment.status === 'completed'
                                    ? 'text-brand-600'
                                    : order.payment.status === 'failed'
                                      ? 'text-red-600'
                                      : 'text-amber-600'
                                }`}>
                                  {order.payment.status_display}
                                </span>
                              </div>
                            )}
                          </div>

                          {order.status === 'pending' && (
                            <div className="space-y-2.5 mt-4">
                              {cardEnabled && order.payment && order.payment.status !== 'completed' && (
                                <button
                                  onClick={e => { e.stopPropagation(); handlePayNow(order.id) }}
                                  disabled={payingId === order.id}
                                  className="btn-primary w-full !py-2.5 text-sm"
                                >
                                  {payingId === order.id ? (
                                    <>
                                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                      جارٍ فتح الدفع...
                                    </>
                                  ) : (
                                    <>
                                      <CreditCard size={16} />
                                      ادفع الآن بالبطاقة
                                    </>
                                  )}
                                </button>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); handleCancel(order.id) }}
                                className="w-full border-[1.5px] border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 transition"
                              >
                                إلغاء الطلب
                              </button>
                            </div>
                          )}

                          {/* ✅ زر الفاتورة الضريبية الإلكترونية */}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setInvoiceOrderId(invoiceOrderId === order.id ? null : order.id)
                            }}
                            className="w-full mt-2.5 border-[1.5px] border-brand-200 text-brand-700 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-50 transition flex items-center justify-center gap-2"
                          >
                            <Receipt size={15} />
                            {invoiceOrderId === order.id ? 'إخفاء الفاتورة' : 'عرض الفاتورة الضريبية'}
                          </button>

                          {invoiceOrderId === order.id && (
                            <div className="mt-3" onClick={e => e.stopPropagation()}>
                              <InvoiceView orderId={order.id} compact />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* تحميل المزيد */}
          {hasMore && (
            <div className="text-center mt-8">
              <button onClick={loadMore} disabled={loadingMore} className="btn-outline">
                {loadingMore ? (
                  <>
                    <span className="w-4 h-4 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                    جارٍ التحميل...
                  </>
                ) : (
                  <>عرض المزيد ({Math.max(0, count - orders.length)} طلباً متبقياً)</>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
