interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizes = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' }

export function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div
        className={`${sizes[size]} border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin`}
        role="status"
        aria-label={label ?? 'جارٍ التحميل'}
      />
      {label && <p className="text-gray-500 text-sm">{label}</p>}
    </div>
  )
}

export function PageLoader({ label = 'جارٍ التحميل...' }: { label?: string }) {
  return <Spinner size="lg" label={label} />
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-4">📦</div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
      {subtitle && <p className="text-gray-500">{subtitle}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">حدث خطأ</h3>
      <p className="text-gray-500 mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="bg-brand-600 text-white px-6 py-2 rounded-xl hover:bg-brand-700 font-bold">
          إعادة المحاولة
        </button>
      )}
    </div>
  )
}
