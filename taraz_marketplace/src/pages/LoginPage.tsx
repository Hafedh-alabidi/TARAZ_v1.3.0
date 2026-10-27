import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LogIn, UserRound, KeyRound } from 'lucide-react'
import { authAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/stores/toast'
import AuthLayout from '@/components/AuthLayout'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore(s => s.setAuth)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setSubmitting(true)
    setError(null)
    try {
      const { user, token } = await authAPI.login({ username: username.trim(), password })
      setAuth(user, token)
      toast.success(`أهلاً بعودتك ${user.first_name || user.username}!`)
      navigate(from, { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="أهلاً بعودتك 👋"
      subtitle="سجّل دخولك لمتابعة التسوق وتتبع طلباتك وفواتيرك الإلكترونية"
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link to="/register" state={{ from }} className="text-brand-700 font-bold hover:underline">
            أنشئ حساباً جديداً
          </Link>
        </>
      }
    >
      {error && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-6 text-sm font-medium animate-fade-in">
          {error}
        </div>
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
            <UserRound size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-stone-700">كلمة المرور</label>
            <Link
              to="/forgot-password"
              className="text-xs text-brand-600 font-bold hover:text-brand-800 hover:underline"
            >
              نسيت كلمة المرور؟
            </Link>
          </div>
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
            <KeyRound size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full !py-3.5 !text-base mt-2">
          {submitting ? (
            <>
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              جارٍ تسجيل الدخول...
            </>
          ) : (
            <>
              <LogIn size={19} />
              تسجيل الدخول
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  )
}
