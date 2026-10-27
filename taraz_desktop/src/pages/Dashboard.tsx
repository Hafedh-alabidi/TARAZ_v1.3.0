import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import {
  TrendingUp, Users, Package, ShoppingCart, AlertTriangle, RefreshCw,
  ArrowLeft, BadgeCheck, Hourglass, Wallet,
} from 'lucide-react'
import { dashboardAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { PageLoader, ErrorState } from '@/components/ui'
import type { DashboardStats } from '@/api/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار', confirmed: 'مؤكد', shipped: 'تم الشحن',
  delivered: 'تم التسليم', cancelled: 'ملغي',
}

function StatCard({ title, value, icon, color, hint, delay }: {
  title: string; value: string; icon: React.ReactNode; color: string; hint?: string; delay?: string
}) {
  return (
    <div className={`card p-6 hover:shadow-luxe hover:-translate-y-0.5 transition-all ${delay ?? ''}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-stone-500 text-sm font-medium">{title}</p>
          <p className="text-[1.55rem] font-black font-display text-stone-900 mt-1.5 tabular-nums truncate">{value}</p>
          {hint && <p className="text-xs text-stone-400 mt-1.5">{hint}</p>}
        </div>
        <span className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
          {icon}
        </span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user = useAuthStore(s => s.user)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await dashboardAPI.stats()
      setStats(data)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // تحديث تلقائي كل 60 ثانية
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  if (loading && !stats) return <PageLoader label="جارٍ تحميل لوحة التحكم..." />
  if (error && !stats) return (
    <div className="p-8">
      <ErrorState message={error} onRetry={load} />
    </div>
  )
  if (!stats) return null

  const fmt = (n: number) => n.toLocaleString('ar-SA', { maximumFractionDigits: 0 })

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black font-display text-stone-900">لوحة التحكم</h1>
          <p className="text-stone-500 mt-1.5">
            أهلاً {user?.first_name || user?.username} — إليك ملخص أداء المتجر اليوم
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-stone-200 px-5 py-2.5 rounded-xl hover:border-brand-400 hover:text-brand-700 transition text-stone-600 font-bold text-sm shadow-soft disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* بطاقات المؤشرات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 mb-5">
        <StatCard
          title="مبيعات اليوم"
          value={`${fmt(stats.revenue.today)} ر.س`}
          icon={<TrendingUp size={23} className="text-brand-600" />}
          color="bg-brand-50 border border-brand-100"
          hint={`الشهر: ${fmt(stats.revenue.month)} ر.س`}
          delay="animate-fade-up"
        />
        <StatCard
          title="طلبات اليوم"
          value={fmt(stats.orders.today)}
          icon={<ShoppingCart size={23} className="text-sky-600" />}
          color="bg-sky-50 border border-sky-100"
          hint={`معلقة: ${fmt(stats.orders.pending)}`}
          delay="animate-fade-up stagger-1"
        />
        <StatCard
          title="المنتجات"
          value={fmt(stats.inventory.products)}
          icon={<Package size={23} className="text-violet-600" />}
          color="bg-violet-50 border border-violet-100"
          hint={`قيمة المخزون: ${fmt(stats.inventory.value)} ر.س`}
          delay="animate-fade-up stagger-2"
        />
        <StatCard
          title="العملاء"
          value={fmt(stats.customers.total)}
          icon={<Users size={23} className="text-gold-600" />}
          color="bg-gold-50 border border-gold-100"
          hint={`إجمالي المبيعات: ${fmt(stats.revenue.total)} ر.س`}
          delay="animate-fade-up stagger-3"
        />
      </div>

      {/* ✅ دقة الإيرادات (P1): المحصّل فعلياً مقابل قيمة الطلبات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-ink-950 via-brand-950 to-brand-900 text-white p-6 shadow-luxe animate-fade-up">
          <div className="absolute inset-0 pattern-diamond pointer-events-none" />
          <div className="glow-gold w-36 h-36 -top-8 -right-8 opacity-60" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs font-bold mb-1.5">الإيراد المحصّل فعلياً</p>
              <p className="text-2xl font-black font-display text-gold-200 tabular-nums">
                {fmt(stats.revenue.collected_total)} ر.س
              </p>
              <p className="text-[11px] text-white/50 mt-1.5">هذا الشهر: {fmt(stats.revenue.collected_month)} ر.س</p>
            </div>
            <span className="shrink-0 w-12 h-12 rounded-2xl bg-white/[0.07] border border-white/15 flex items-center justify-center">
              <BadgeCheck size={23} className="text-gold-300" />
            </span>
          </div>
        </div>

        <StatCard
          title="قيمة طلبات غير محصّلة"
          value={`${fmt(stats.revenue.outstanding)} ر.س`}
          icon={<Hourglass size={23} className="text-amber-600" />}
          color="bg-amber-50 border border-amber-100"
          hint="طلبات معلقة/بانتظار تأكيد التحويل"
          delay="animate-fade-up stagger-1"
        />
        <StatCard
          title="إجمالي قيمة الطلبات"
          value={`${fmt(stats.revenue.total)} ر.س`}
          icon={<Wallet size={23} className="text-brand-600" />}
          color="bg-brand-50 border border-brand-100"
          hint="غير الملغاة — بغض النظر عن التحصيل"
          delay="animate-fade-up stagger-2"
        />
        <div className="card p-6 flex flex-col justify-center animate-fade-up stagger-3">
          <p className="text-stone-500 text-sm font-medium mb-2">نسبة التحصيل</p>
          {stats.revenue.total > 0 ? (
            <>
              <p className="text-[1.55rem] font-black font-display text-brand-700 tabular-nums">
                {Math.round((stats.revenue.collected_total / stats.revenue.total) * 100)}%
              </p>
              <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden mt-3">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-brand-400 via-brand-500 to-brand-600 transition-all duration-700"
                  style={{ width: `${Math.min(100, (stats.revenue.collected_total / stats.revenue.total) * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-stone-400 text-sm">لا توجد طلبات بعد</p>
          )}
        </div>
      </div>

      {/* تنبيهات المخزون */}
      {(stats.inventory.low_stock > 0 || stats.inventory.out_of_stock > 0) && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="text-amber-600" size={22} />
            </span>
            <p className="text-amber-800">
              <span className="font-black">{stats.inventory.low_stock}</span> منتجات تحت الحد الأدنى
              {stats.inventory.out_of_stock > 0 && (
                <> و <span className="font-black text-red-700">{stats.inventory.out_of_stock}</span> نفدت من المخزون</>
              )}
            </p>
          </div>
          <Link to="/inventory" className="text-amber-700 font-bold text-sm flex items-center gap-1 hover:underline">
            مراجعة المخزون <ArrowLeft size={14} />
          </Link>
        </div>
      )}

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-8">
        <div className="xl:col-span-2 card p-6">
          <h2 className="text-xl font-bold font-display mb-6 text-stone-900">مبيعات آخر 30 يوماً</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.sales_by_day}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: 'IBM Plex Sans Arabic' }} interval={4} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'IBM Plex Sans Arabic' }} />
              <Tooltip formatter={(value: number | string) => [`${Number(value).toLocaleString('ar-SA')} ر.س`, 'المبيعات']} />
              <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fill="url(#revenueGradient)" name="المبيعات" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold font-display mb-6 text-stone-900">عدد الطلبات اليومي</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.sales_by_day.slice(-14)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: 'IBM Plex Sans Arabic' }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(value: number | string) => [value, 'طلبات']} />
              <Bar dataKey="orders" fill="#059669" name="الطلبات" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* أفضل المنتجات + أحدث الطلبات */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="text-xl font-bold font-display mb-6 text-stone-900">أفضل المنتجات مبيعاً</h2>
          <div className="space-y-3.5">
            {stats.top_products.length === 0 && (
              <p className="text-stone-400 text-center py-8">لا توجد مبيعات بعد</p>
            )}
            {stats.top_products.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                  i === 0 ? 'bg-gradient-to-br from-gold-200 to-gold-400 text-ink-900 shadow-gold-glow' :
                  i === 1 ? 'bg-stone-100 text-stone-500' :
                  i === 2 ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-600'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-stone-800 truncate">{p.name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{p.total_quantity} قطعة — <span dir="ltr" className="font-mono">{p.sku}</span></p>
                </div>
                <span className="font-black font-display text-brand-700 whitespace-nowrap tabular-nums">
                  {p.total_sales.toLocaleString('ar-SA')} ر.س
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold font-display text-stone-900">أحدث الطلبات</h2>
            <Link to="/orders" className="text-brand-600 text-sm font-bold flex items-center gap-1 hover:underline">
              عرض الكل <ArrowLeft size={14} />
            </Link>
          </div>
          <div className="divide-y divide-stone-100">
            {stats.recent_orders.length === 0 && (
              <p className="text-stone-400 text-center py-8">لا توجد طلبات بعد</p>
            )}
            {stats.recent_orders.map(order => (
              <div key={order.id} className="flex items-center justify-between py-3.5">
                <div className="min-w-0">
                  <p className="font-mono font-bold text-stone-800 text-sm" dir="ltr">{order.order_number}</p>
                  <p className="text-xs text-stone-400 mt-0.5 truncate">
                    {order.customer_name} — {new Date(order.created_at).toLocaleDateString('ar-SA')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    order.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-brand-50 text-brand-700 border-brand-200'
                  }`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  <span className="font-black text-stone-800 text-sm whitespace-nowrap tabular-nums">
                    {parseFloat(order.final_amount).toLocaleString('ar-SA')} ر.س
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
