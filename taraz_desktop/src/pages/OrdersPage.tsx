import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, Truck, Package, XCircle, Eye, RefreshCw, Clock } from 'lucide-react'
import { ordersAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { toast } from '@/stores/toast'
import { PageLoader, EmptyState, ErrorState } from '@/components/ui'
import type { Order, OrderStatus } from '@/api/types'

const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: 'قيد الانتظار', cls: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'مؤكد', cls: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'تم الشحن', cls: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'تم التسليم', cls: 'bg-green-100 text-green-800' },
  cancelled: { label: 'ملغي', cls: 'bg-red-100 text-red-800' },
}

const FILTERS: Array<{ v: '' | OrderStatus; l: string }> = [
  { v: '', l: 'الكل' },
  { v: 'pending', l: 'قيد الانتظار' },
  { v: 'confirmed', l: 'مؤكد' },
  { v: 'shipped', l: 'مشحون' },
  { v: 'delivered', l: 'مسلّم' },
  { v: 'cancelled', l: 'ملغي' },
]

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'' | OrderStatus>('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [acting, setActing] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await ordersAPI.list({
        ...(filter ? { status: filter } : {}),
        page_size: 100,
      })
      setOrders(data.results)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const transition = async (id: number, action: 'confirm' | 'ship' | 'deliver' | 'cancel') => {
    setActing(id)
    try {
      const updated = await ordersAPI[action](id)
      setOrders(prev => prev.map(o => o.id === id ? updated : o))
      toast.success('تم تحديث حالة الطلب بنجاح')
    } catch (err) {
      toast.error(extractErrorMessage(err))
      load() // إعادة التحميل لإظهار الحالة الحقيقية
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">إدارة الطلبات</h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-white border px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* الفلاتر */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map(f => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f.v ? 'bg-blue-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {loading && orders.length === 0 ? (
        <PageLoader label="جارٍ تحميل الطلبات..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm">
          <EmptyState title="لا توجد طلبات" subtitle={filter ? 'لا توجد طلبات بهذه الحالة' : 'لم يتم إنشاء أي طلب بعد'} />
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const meta = STATUS_META[order.status]
            const isOpen = expanded === order.id
            return (
              <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div
                  className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                >
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${meta.cls}`}>
                      {meta.label}
                    </span>
                    <div>
                      <p className="font-bold text-gray-800 font-mono text-sm">{order.order_number}</p>
                      <p className="text-xs text-gray-500">
                        {order.customer_name} • {new Date(order.created_at).toLocaleString('ar-SA', {
                          dateStyle: 'medium', timeStyle: 'short',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="text-xs text-gray-500">{order.items.length} منتجات</p>
                      <p className="font-bold text-blue-600">
                        {parseFloat(order.final_amount).toLocaleString('ar-SA')} ر.س
                      </p>
                    </div>
                    <Eye size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* أزرار الإجراءات السريعة */}
                <div className="px-4 pb-3 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                  {order.status === 'pending' && (
                    <>
                      <button
                        onClick={() => transition(order.id, 'confirm')}
                        disabled={acting === order.id}
                        className="flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                      >
                        <CheckCircle size={14} /> تأكيد
                      </button>
                      <button
                        onClick={() => transition(order.id, 'cancel')}
                        disabled={acting === order.id}
                        className="flex items-center gap-1.5 text-xs font-medium bg-red-50 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle size={14} /> إلغاء
                      </button>
                    </>
                  )}
                  {order.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => transition(order.id, 'ship')}
                        disabled={acting === order.id}
                        className="flex items-center gap-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                      >
                        <Truck size={14} /> شحن
                      </button>
                      <button
                        onClick={() => transition(order.id, 'cancel')}
                        disabled={acting === order.id}
                        className="flex items-center gap-1.5 text-xs font-medium bg-red-50 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle size={14} /> إلغاء
                      </button>
                    </>
                  )}
                  {order.status === 'shipped' && (
                    <button
                      onClick={() => transition(order.id, 'deliver')}
                      disabled={acting === order.id}
                      className="flex items-center gap-1.5 text-xs font-medium bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100 disabled:opacity-50"
                    >
                      <Package size={14} /> تسليم
                    </button>
                  )}
                  {order.payment && order.payment.status === 'pending' && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
                      <Clock size={14} /> دفعة معلقة ({order.payment.method_display})
                    </span>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t bg-gray-50 p-5 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* المنتجات */}
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm mb-3">المنتجات</h3>
                        <div className="space-y-2">
                          {order.items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm bg-white rounded-lg p-3">
                              <div>
                                <p className="font-medium text-gray-800">{item.product_name}</p>
                                <p className="text-gray-500 text-xs font-mono">{item.product_sku}</p>
                              </div>
                              <div className="text-left">
                                <p className="text-gray-600 text-xs">{item.quantity} × {parseFloat(item.unit_price).toLocaleString('ar-SA')}</p>
                                <p className="font-bold text-gray-700">{parseFloat(item.subtotal).toLocaleString('ar-SA')} ر.س</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* الفاتورة */}
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm mb-3">الفاتورة</h3>
                        <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
                          <div className="flex justify-between text-gray-600">
                            <span>المجموع الفرعي</span><span>{parseFloat(order.total_amount).toLocaleString('ar-SA')} ر.س</span>
                          </div>
                          {parseFloat(order.discount) > 0 && (
                            <div className="flex justify-between text-red-600">
                              <span>الخصم</span><span>- {parseFloat(order.discount).toLocaleString('ar-SA')}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-gray-600">
                            <span>الضريبة</span><span>{parseFloat(order.tax).toLocaleString('ar-SA')} ر.س</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>الشحن</span><span>{parseFloat(order.shipping_fee).toLocaleString('ar-SA')} ر.س</span>
                          </div>
                          <div className="flex justify-between font-bold text-gray-800 border-t pt-2">
                            <span>الإجمالي</span>
                            <span className="text-blue-600">{parseFloat(order.final_amount).toLocaleString('ar-SA')} ر.س</span>
                          </div>
                          {order.payment && (
                            <div className="flex justify-between text-gray-600 text-xs pt-1">
                              <span>الدفع</span>
                              <span>{order.payment.method_display} — {order.payment.status_display}</span>
                            </div>
                          )}
                          {order.commission && (
                            <div className="flex justify-between text-gray-600 text-xs">
                              <span>العمولة</span>
                              <span>{parseFloat(order.commission.amount).toLocaleString('ar-SA')} ر.س</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* الشحن */}
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm mb-3">بيانات الشحن</h3>
                        <div className="bg-white rounded-lg p-4 text-sm space-y-2 text-gray-700">
                          <p><span className="text-gray-500">الاسم:</span> {order.shipping_name || '—'}</p>
                          <p><span className="text-gray-500">الهاتف:</span> <span dir="ltr">{order.shipping_phone || '—'}</span></p>
                          <p><span className="text-gray-500">المدينة:</span> {order.shipping_city || '—'}</p>
                          <p><span className="text-gray-500">العنوان:</span> {order.shipping_address || '—'}</p>
                          {order.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 mt-2">{order.notes}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
