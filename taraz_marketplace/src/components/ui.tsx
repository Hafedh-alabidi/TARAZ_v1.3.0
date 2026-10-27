import { PackageSearch, AlertTriangle, RefreshCw } from 'lucide-react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizes = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' }

export function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-14">
      <div className="relative">
        <div
          className={`${sizes[size]} rounded-full border-[3px] border-brand-100 border-t-brand-600 animate-spin`}
          role="status"
          aria-label={label ?? 'جارٍ التحميل'}
        />
        <div className={`absolute inset-0 ${sizes[size]} rounded-full bg-brand-500/10 animate-pulse-soft`} />
      </div>
      {label && (
        <p className="text-stone-500 text-sm font-medium flex items-center gap-2">
          <span className="inline-block w-4 h-px bg-gold-400" />
          {label}
          <span className="inline-block w-4 h-px bg-gold-400" />
        </p>
      )}
    </div>
  )
}

export function PageLoader({ label = 'جارٍ التحميل...' }: { label?: string }) {
  return <Spinner size="lg" label={label} />
}

/** شبكة هياكل تحميل لامعة لبطاقات المنتجات — بنفس شكل البطاقة الفعلي */
export function ProductsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-9">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-square !rounded-xl" />
          <div className="pt-4 space-y-2.5">
            <div className="skeleton h-3 w-1/4 !rounded-md" />
            <div className="skeleton h-4 w-4/5 !rounded-md" />
            <div className="skeleton h-5 w-1/3 mt-3 !rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center py-20">
      <div className="relative inline-flex items-center justify-center mb-6">
        <div className="absolute inset-0 rounded-full bg-brand-100/60 blur-xl" />
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200/60 flex items-center justify-center">
          <PackageSearch size={36} className="text-brand-600" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-stone-800 mb-2">{title}</h3>
      {subtitle && <p className="text-stone-500 max-w-sm mx-auto leading-relaxed">{subtitle}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="relative inline-flex items-center justify-center mb-6">
        <div className="absolute inset-0 rounded-full bg-red-100/60 blur-xl" />
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200/60 flex items-center justify-center">
          <AlertTriangle size={36} className="text-red-600" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-stone-800 mb-2">حدث خطأ</h3>
      <p className="text-stone-500 mb-6 max-w-sm mx-auto">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-outline btn-sm">
          <RefreshCw size={16} />
          إعادة المحاولة
        </button>
      )}
    </div>
  )
}

/** شارة حالة الطلب — ألوان دلالية متناسقة */
const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-brand-50 text-brand-700 border-brand-200',
  shipped: 'bg-sky-50 text-sky-700 border-sky-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

export function StatusBadge({ status, display }: { status: string; display?: string }) {
  const cls = ORDER_STATUS_STYLES[status] ?? 'bg-stone-100 text-stone-700 border-stone-200'
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-soft" />
      {display ?? status}
    </span>
  )
}

/** عنوان قسم موحد */
export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div>
        {eyebrow && <span className="eyebrow mb-2">{eyebrow}</span>}
        <h2 className="text-2xl md:text-[2rem] font-extrabold text-stone-900 leading-tight">{title}</h2>
      </div>
      {action}
    </div>
  )
}
