import { useEffect, useState } from 'react'
import { Printer, FileCheck2 } from 'lucide-react'
import { ordersAPI } from '@/api/endpoints'
import { LogoMark } from '@/components/Logo'
import type { InvoiceData } from '@/api/types'

/**
 * ✅ P0-3 (واجهة): عرض الفاتورة الإلكترونية المبسطة —
 * بيانات البائع والعميل والبنود والإجماليات + رمز QR بترميز TLV.
 * تُستخدم في شاشة نجاح الطلب وفي صفحة «طلباتي» — وتُطبع بتنسيق طباعي نظيف.
 */
export default function InvoiceView({ orderId, compact = false }: { orderId: number; compact?: boolean }) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ordersAPI.invoice(orderId)
      .then(setInvoice)
      .catch(() => setError('تعذر تحميل الفاتورة'))
      .finally(() => setLoading(false))
  }, [orderId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 text-stone-500 py-8 text-sm">
        <span className="w-5 h-5 border-2 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
        جارٍ تحميل الفاتورة...
      </div>
    )
  }
  if (error || !invoice) {
    return <p className="text-sm text-red-600 py-4">{error ?? 'فاتورة غير متاحة'}</p>
  }

  const fmt = (v: string) => parseFloat(v).toLocaleString('ar-SA', { minimumFractionDigits: 2 })

  return (
    <div className="print-area bg-white border border-stone-200/80 rounded-2xl overflow-hidden shadow-soft">
      {/* رأس الفاتورة */}
      <div className="relative bg-gradient-to-bl from-ink-950 via-brand-950 to-brand-900 text-white p-6 flex items-center justify-between gap-5 overflow-hidden">
        <div className="absolute inset-0 pattern-diamond pointer-events-none" />
        <div className="glow-gold w-56 h-56 -top-16 -right-10 opacity-50" />

        <div className="relative flex items-center gap-4">
          <LogoMark size={52} />
          <div>
            <p className="text-[11px] text-gold-200/90 font-bold flex items-center gap-1.5">
              <FileCheck2 size={13} />
              فاتورة ضريبية إلكترونية مبسطة
            </p>
            <p className="font-bold text-xl font-mono mt-1" dir="ltr">{invoice.invoice_number}</p>
            <p className="text-[11px] text-white/60 mt-1">
              {new Date(invoice.issued_at).toLocaleString('ar-SA')}
            </p>
          </div>
        </div>

        {invoice.zatca?.qr_png && (
          <div className="relative shrink-0 text-center">
            <img
              src={invoice.zatca.qr_png}
              alt="رمز التحقق الضريبي"
              className="w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-xl p-2 shadow-lg"
            />
            <p className="text-[9px] text-white/50 mt-1.5">امسح للتحقق الضريبي</p>
          </div>
        )}
      </div>

      <div className={`p-5 ${compact ? 'space-y-4' : 'space-y-5'}`}>
        {/* البائع والعميل */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-stone-50 border border-stone-200/60 rounded-xl p-4">
            <p className="text-[11px] text-stone-400 font-bold mb-1.5">البائع</p>
            <p className="font-bold text-stone-800">{invoice.seller.name}</p>
            <p className="text-stone-500 mt-1 tabular-nums" dir="ltr">
              الرقم الضريبي: {invoice.seller.vat_number}
            </p>
          </div>
          <div className="bg-stone-50 border border-stone-200/60 rounded-xl p-4">
            <p className="text-[11px] text-stone-400 font-bold mb-1.5">العميل</p>
            <p className="font-bold text-stone-800">{invoice.customer.name}</p>
            {invoice.customer.phone && (
              <p className="text-stone-500 mt-1" dir="ltr">{invoice.customer.phone}</p>
            )}
          </div>
        </div>

        {/* البنود */}
        <div className="border border-stone-200/70 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-stone-500 text-xs">
                <th className="p-3 text-right font-bold">الصنف</th>
                <th className="p-3 text-center font-bold">الكمية</th>
                <th className="p-3 text-center font-bold">سعر الوحدة</th>
                <th className="p-3 text-center font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {invoice.items.map((item, i) => (
                <tr key={i} className="hover:bg-stone-50/60 transition-colors">
                  <td className="p-3 text-stone-800 font-semibold">
                    {item.name}
                    <span className="block text-[10px] text-stone-300 font-mono" dir="ltr">{item.sku}</span>
                  </td>
                  <td className="p-3 text-center text-stone-600 tabular-nums">{item.quantity}</td>
                  <td className="p-3 text-center text-stone-600 tabular-nums" dir="ltr">{fmt(item.unit_price)}</td>
                  <td className="p-3 text-center font-bold text-stone-800 tabular-nums" dir="ltr">{fmt(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* الإجماليات */}
        <div className="bg-stone-50 border border-stone-200/60 rounded-xl p-5 text-sm space-y-2.5">
          <div className="flex justify-between text-stone-500">
            <span>المجموع الفرعي</span>
            <span className="font-semibold text-stone-700 tabular-nums" dir="ltr">{fmt(invoice.totals.subtotal)} ر.س</span>
          </div>
          {parseFloat(invoice.totals.discount) > 0 && (
            <div className="flex justify-between text-stone-500">
              <span>الخصم</span>
              <span className="font-semibold text-red-600 tabular-nums" dir="ltr">-{fmt(invoice.totals.discount)} ر.س</span>
            </div>
          )}
          <div className="flex justify-between text-stone-500">
            <span>الضريبة العامة على المبيعات ({Math.round(invoice.totals.tax_rate * 100)}%)</span>
            <span className="font-semibold text-stone-700 tabular-nums" dir="ltr">{fmt(invoice.totals.tax)} ر.س</span>
          </div>
          <div className="flex justify-between text-stone-500">
            <span>الشحن</span>
            <span className="font-semibold text-stone-700 tabular-nums" dir="ltr">
              {parseFloat(invoice.totals.shipping_fee) === 0 ? 'مجاني' : `${fmt(invoice.totals.shipping_fee)} ر.س`}
            </span>
          </div>
          <div className="flex justify-between font-black text-stone-800 border-t-2 border-dashed border-stone-200 pt-3 text-base">
            <span>الإجمالي المستحق</span>
            <span className="text-brand-700 font-display text-lg tabular-nums" dir="ltr">
              {fmt(invoice.totals.final_amount)} ر.س
            </span>
          </div>
          {invoice.payment && (
            <div className="flex justify-between text-stone-400 text-xs pt-1.5 border-t border-stone-200/60">
              <span>{invoice.payment.method_display} — {invoice.payment.status_display}</span>
              {invoice.payment.transaction_id && (
                <span dir="ltr" className="font-mono">{invoice.payment.transaction_id}</span>
              )}
            </div>
          )}
        </div>

        <p className="text-[10px] text-stone-400 text-center leading-relaxed px-4">
          فاتورة إلكترونية مبسطة صادرة وفق متطلبات مصلحة الضرائب اليمنية.
          رمز QR يحوي بيانات البائع والرقم الضريبي والطابع الزمني والإجمالي والضريبة بترميز TLV.
        </p>

        <button
          onClick={() => window.print()}
          className="no-print w-full flex items-center justify-center gap-2 border-[1.5px] border-brand-200 text-brand-700 py-2.5 rounded-xl font-bold hover:bg-brand-50 transition text-sm"
        >
          <Printer size={16} /> طباعة الفاتورة
        </button>
      </div>
    </div>
  )
}
