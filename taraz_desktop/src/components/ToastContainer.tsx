import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import { useToastStore } from '@/stores/toast'

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  const icons = {
    success: <CheckCircle size={20} className="text-green-600 shrink-0" />,
    error: <AlertCircle size={20} className="text-red-600 shrink-0" />,
    info: <Info size={20} className="text-blue-600 shrink-0" />,
  }

  const borders = {
    success: 'border-r-4 border-r-green-500',
    error: 'border-r-4 border-r-red-500',
    info: 'border-r-4 border-r-blue-500',
  }

  return (
    <div className="fixed top-20 left-4 z-[100] space-y-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`animate-fade-in bg-white shadow-lg rounded-lg p-4 flex items-center gap-3 ${borders[t.type]}`}
          role="alert"
        >
          {icons[t.type]}
          <p className="text-sm text-gray-800 flex-1">{t.message}</p>
          <button onClick={() => removeToast(t.id)} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
