import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { authAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/stores/toast'
import AuthLayout from '@/components/AuthLayout'

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    phone: '', password: '', password2: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore(s => s.setAuth)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const valid =
    form.username.trim().length >= 3 &&
    /^\S+@\S+\.\S+$/.test(form.email) &&
    form.password.length >= 8 &&
    form.password === form.password2

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      const { user, token } = await authAPI.register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        password2: form.password2,
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
      })
      setAuth(user, token)
      toast.success('تم إنشاء حسابك بنجاح — أهلاً بك في طراز!')
      navigate(from, { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="أنشئ حسابك مجاناً"
      subtitle="دقيقة واحدة تفصلك عن تجربة تسوّق كاملة بفواتير موثقة وتتبع مباشر"
      quote={{
        text: 'انضم لعائلة طراز',
        author: 'آلاف المنتجات، أسعار منافسة، وتجربة تسوّق تعتني بالتفاصيل الصغيرة.',
      }}
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link to="/login" state={{ from }} className="text-brand-700 font-bold hover:underline">
            سجّل دخولك
          </Link>
        </>
      }
    >
      {error && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-6 text-sm font-medium animate-fade-in">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">الاسم الأول</label>
            <input type="text" value={form.first_name} onChange={set('first_name')}
              className="input-luxe" placeholder="أحمد" autoComplete="given-name" />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">اسم العائلة</label>
            <input type="text" value={form.last_name} onChange={set('last_name')}
              className="input-luxe" placeholder="المطيري" autoComplete="family-name" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">اسم المستخدم *</label>
            <input type="text" value={form.username} onChange={set('username')}
              className="input-luxe" placeholder="ahmed2026" autoComplete="username" required minLength={3} />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">البريد الإلكتروني *</label>
            <input type="email" value={form.email} onChange={set('email')} dir="ltr"
              className="input-luxe text-left" placeholder="you@example.com" autoComplete="email" required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-stone-700 mb-2">
            رقم الهاتف
            <span className="text-stone-400 font-medium text-xs mr-2">(لإشعارات الطلب — اختياري)</span>
          </label>
          <input type="tel" value={form.phone} onChange={set('phone')} dir="ltr"
            className="input-luxe text-left" placeholder="05xxxxxxxx" autoComplete="tel" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">كلمة المرور *</label>
            <input type="password" value={form.password} onChange={set('password')}
              className="input-luxe" placeholder="8 أحرف على الأقل" autoComplete="new-password"
              required minLength={8} />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">تأكيد كلمة المرور *</label>
            <input type="password" value={form.password2} onChange={set('password2')}
              className="input-luxe" placeholder="أعد كلمة المرور" autoComplete="new-password"
              required minLength={8} />
            {form.password2 && form.password !== form.password2 && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">كلمتا المرور غير متطابقتين</p>
            )}
          </div>
        </div>

        <button type="submit" disabled={submitting || !valid} className="btn-primary w-full !py-3.5 !text-base mt-2">
          {submitting ? (
            <>
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              جارٍ إنشاء الحساب...
            </>
          ) : (
            <>
              <UserPlus size={19} />
              إنشاء الحساب
            </>
          )}
        </button>

        <p className="text-[11px] text-stone-400 leading-relaxed text-center">
          بإنشاء الحساب أنت توافق على{' '}
          <Link to="/terms" className="text-brand-600 hover:underline">الشروط والأحكام</Link> و
          <Link to="/privacy" className="text-brand-600 hover:underline"> سياسة الخصوصية</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
