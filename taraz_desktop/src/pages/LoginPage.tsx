import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, User, ShieldCheck, KeyRound } from 'lucide-react'
import { authAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/stores/toast'
import { LogoFull } from '@/components/Logo'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setSubmitting(true)
    setError(null)
    try {
      const { user, token } = await authAPI.login({ username: username.trim(), password })
      // تطبيق الإدارة للموظفين فقط (admin / manager / employee)
      if (!setAuth(user, token)) {
        setError('هذا الحساب بحسب عميل — تطبيق الإدارة متاح لموظفي النظام فقط')
        return
      }
      toast.success(`أهلاً بك ${user.first_name || user.username} 👋`)
      navigate('/', { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-bl from-ink-950 via-brand-950 to-ink-900 flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 pattern-diamond pointer-events-none" />
      <div className="glow-gold w-[520px] h-[520px] -top-40 -left-32 opacity-70" />
      <div className="glow-gold w-80 h-80 bottom-0 right-0 opacity-40" />

      <div className="relative w-full max-w-md">
        {/* بطاقة الدخول */}
        <div className="bg-white/95 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-float animate-scale-in">
          <div className="flex justify-center mb-8">
            <LogoFull size={56} />
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display font-black text-2xl text-stone-900">تسجيل دخول الموظفين</h1>
            <p className="text-stone-500 text-sm mt-2">نظام إدارة المبيعات والمخزون ونقطة البيع</p>
          </div>

          {error && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-6 text-sm text-center font-medium animate-fade-in">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">اسم المستخدم</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="input-luxe pr-11"
                  placeholder="أدخل اسم المستخدم"
                  autoComplete="username"
                  required
                />
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">كلمة المرور</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-luxe pr-11"
                  placeholder="أدخل كلمة المرور"
                  autoComplete="current-password"
                  required
                />
                <KeyRound className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-l from-brand-600 to-brand-800 text-white py-3.5 rounded-2xl font-black font-display text-base hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-luxe disabled:opacity-60 disabled:translate-y-0 flex items-center justify-center gap-2.5"
            >
              {submitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  جارٍ التحقق...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  تسجيل الدخول
                </>
              )}
            </button>
          </form>

          {/* حسابات تجريبية */}
          <div className="mt-8 border-t border-stone-100 pt-6">
            <p className="text-xs text-stone-400 mb-3 font-bold flex items-center justify-center gap-1.5">
              <ShieldCheck size={13} className="text-brand-500" />
              حسابات تجريبية (بعد seed_data)
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { role: 'مشرف', user: 'admin' },
                { role: 'مدير', user: 'manager1' },
                { role: 'موظف', user: 'employee1' },
              ].map(acc => (
                <div
                  key={acc.user}
                  className="bg-stone-50 border border-stone-200/60 rounded-xl p-2.5 cursor-pointer hover:border-brand-300 hover:bg-brand-50/50 transition group"
                  onClick={() => setUsername(acc.user)}
                  title="اضغط للتعبئة السريعة"
                >
                  <p className="font-black text-stone-700 group-hover:text-brand-700 transition-colors">{acc.role}</p>
                  <p className="text-stone-400 font-mono mt-0.5" dir="ltr">{acc.user}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-white/40 text-xs mt-6 tracking-wide">
          © 2026 TARAZ — نظام إدارة المبيعات · للموظفين المصرح لهم فقط
        </p>
      </div>
    </div>
  )
}
