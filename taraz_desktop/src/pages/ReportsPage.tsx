import { useEffect, useState, useCallback } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { RefreshCw, TrendingUp, Package, Users, AlertTriangle } from 'lucide-react'
import { dashboardAPI, ordersAPI, commissionsAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { toast } from '@/stores/toast'
import { PageLoader, ErrorState } from '@/components/ui'
import type { DashboardStats, OrderStatistics } from '@/api/types'

interface CommissionSummary { total: string; paid: string; pending: string }

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [orderStats, setOrderStats] = useState<OrderStatistics | null>(null)
  const [commissions, setCommissions] = useState<CommissionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [d, o, c] = await Promise.all([
        dashboardAPI.stats(),
        ordersAPI.statistics(),
        commissionsAPI.summary().catch(() => null),
      ])
      setStats(d)
      setOrderStats(o)
      setCommissions(c)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const exportCsv = () => {
    if (!stats) return
    const rows = [
      ['التاريخ', 'المبيعات', 'عدد الطلبات'],
      ...stats.sales_by_day.map(d => [d.date, d.revenue, d.orders]),
    ]
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `taraz-sales-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير تقرير المبيعات')
  }

  if (loading && !stats) return <PageLoader label="جارٍ تحميل التقارير..." />
  if (error && !stats) return <div className="p-8"><ErrorState message={error} onRetry={load} /></div>
  if (!stats) return null

  const fmt = (n: number | string) => Number(n).toLocaleString('ar-SA', { maximumFractionDigits: 2 })

  // بيانات الرسم الدائري لحالات الطلبات
  const statusData = orderStats ? [
    { name: 'قيد الانتظار', value: orderStats.pending_orders, color: '#f59e0b' },
    { name: 'مؤكد', value: orderStats.confirmed_orders, color: '#3b82f6' },
    { name: 'مشحون', value: orderStats.shipped_orders, color: '#6366f1' },
    { name: 'مسلّم', value: orderStats.delivered_orders, color: '#10b981' },
    { name: 'ملغي', value: orderStats.cancelled_orders, color: '#ef4444' },
  ].filter(d => d.value > 0) : []

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <h1 className="text-3xl font-bold text-gray-800">التقارير والتحليلات</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-white border px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> تحديث
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
          >
            تصدير CSV
          </button>
        </div>
      </div>

      {/* ملخص الأعمال */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي المبيعات</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(stats.revenue.total)} ر.س</p>
            </div>
            <TrendingUp size={36} className="text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(stats.orders.total)}</p>
              {orderStats && (
                <p className="text-xs text-gray-400 mt-1">متوسط الطلب: {fmt(Number(orderStats.total_revenue) / Math.max(orderStats.total_orders, 1))} ر.س</p>
              )}
            </div>
            <Package size={36} className="text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">قيمة المخزون</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(stats.inventory.value)} ر.س</p>
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={12} /> {stats.inventory.low_stock} منتجات منخفضة
              </p>
            </div>
            <Package size={36} className="text-purple-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي العملاء</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(stats.customers.total)}</p>
              {commissions && (
                <p className="text-xs text-gray-400 mt-1">
                  عمولات معلقة: {fmt(commissions.pending)} ر.س
                </p>
              )}
            </div>
            <Users size={36} className="text-orange-500" />
          </div>
        </div>
      </div>

      {/* الرسوم */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div className="xl:col-span-2 bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-6 text-gray-800">اتجاه المبيعات (30 يوماً)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.sales_by_day}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number | string) => [`${Number(v).toLocaleString('ar-SA')} ر.س`, 'المبيعات']} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-6 text-gray-800">توزيع حالات الطلبات</h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}
                >
                  {statusData.map(d => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-20">لا توجد بيانات</p>
          )}
        </div>
      </div>

      {/* أفضل المنتجات + ملخص العمولات */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-6 text-gray-800">أفضل 5 منتجات مبيعاً</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.top_products} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
              <Tooltip formatter={(v: number | string) => [`${Number(v).toLocaleString('ar-SA')} ر.س`, 'المبيعات']} />
              <Bar dataKey="total_sales" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-6 text-gray-800">ملخص العمولات</h2>
          {commissions ? (
            <div className="space-y-4">
              {[
                { label: 'إجمالي العمولات', value: commissions.total, cls: 'text-gray-800', bar: 'bg-gray-400' },
                { label: 'مدفوعة', value: commissions.paid, cls: 'text-green-600', bar: 'bg-green-500' },
                { label: 'معلقة', value: commissions.pending, cls: 'text-amber-600', bar: 'bg-amber-500' },
              ].map(row => {
                const max = Number(commissions.total) || 1
                const pct = Math.min((Number(row.value) / max) * 100, 100)
                return (
                  <div key={row.label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-gray-600 text-sm">{row.label}</span>
                      <span className={`font-bold ${row.cls}`}>{fmt(row.value)} ر.س</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${row.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              <div className="pt-4 border-t text-sm text-gray-500">
                نسبة العمولة: 5% من قيمة كل طلب — تُحتسب تلقائياً عند إنشاء الطلب
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-16">لا تملك صلاحية عرض العمولات</p>
          )}
        </div>
      </div>
    </div>
  )
}
