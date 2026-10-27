import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import { useToastStore } from '@/stores/toast'

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  const icons = {
    success: <CheckCircle size={20} className="text-brand-600 shrink-0" />,
    error: <AlertCircle size={20} className="text-red-600 shrink-0" />,
    info: <Info size={20} className="text-sky-600 shrink-0" />,
  }

  const accents = {
    success: 'from-brand-400 to-brand-600',
    error: 'from-red-400 to-red-600',
    info: 'from-sky-400 to-sky-600',
  }

  return (
    <div className="fixed top-24 left-4 z-[100] space-y-2.5 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map(t => (
        <div
          key={t.id}
          className="relative overflow-hidden bg-white/95 backdrop-blur shadow-float rounded-2xl p-4 pr-5 flex items-center gap-3 animate-scale-in origin-left"
          role="alert"
        >
          {/* حد جانبي متدرج */}
          <span className={`absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b ${accents[t.type]}`} />
          {icons[t.type]}
          <p className="text-sm text-stone-800 font-medium flex-1 leading-relaxed">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
            aria-label="إغلاق"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}
