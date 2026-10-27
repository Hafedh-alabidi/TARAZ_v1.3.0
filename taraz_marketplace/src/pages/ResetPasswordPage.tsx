import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck, PartyPopper, ArrowRight } from 'lucide-react'
import { authAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { toast } from '@/stores/toast'
import AuthLayout from '@/components/AuthLayout'

/**
 * ✅ P0-2: تعيين كلمة مرور جديدة عبر رابط البريد (uid + token).
 * الرمز أحادي الاستخدام — عند فشل التحقق يُطلب رابط جديد.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const navigate = useNavigate()

  const valid = uid && token
  const passwordsMatch = password === password2
  const longEnough = password.length >= 8

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || !passwordsMatch || !longEnough) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await authAPI.confirmPasswordReset({
        uid, token, new_password: password, new_password2: password2,
      })
      setDone(true)
      toast.success(res.detail || 'تم تعيين كلمة المرور الجديدة')
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!valid) {
    return (
      <AuthLayout
        title="رابط غير صالح"
        subtitle="رابط إعادة التعيين ناقص أو تالف — يمكنك طلب رابط جديد خلال لحظات."
      >
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200/60 flex items-center justify-center">
            <ShieldCheck size={36} className="text-amber-600" />
          </div>
          <Link to="/forgot-password" className="btn-primary w-full">
            طلب رابط جديد
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout title="تم بنجاح!" subtitle="تم تعيين كلمة المرور الجديدة — سيتم تحويلك لصفحة الدخول خلال لحظات.">
        <div className="text-center animate-scale-in">
          <div className="relative inline-flex items-center justify-center mb-7">
            <div className="absolute inset-0 rounded-full bg-brand-100/70 blur-xl" />
            <div className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-luxe">
              <PartyPopper size={44} className="text-gold-200" />
            </div>
          </div>
          <p className="text-stone-600 text-sm leading-relaxed mb-7">
            كلمة مرورك الجديدة جاهزة الآن.
            <br />
            استخدمها لتسجيل الدخول ومتابعة التسوق.
          </p>
          <Link to="/login" className="btn-primary w-full">
            تسجيل الدخول الآن
            <ArrowRight size={17} className="rotate-180" />
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="كلمة مرور جديدة"
      subtitle="اختر كلمة مرور قوية يسهل عليك تذكرها — 8 أحرف على الأقل."
      footer={
        <Link to="/login" className="text-brand-700 font-bold hover:underline inline-flex items-center gap-1.5">
          <ArrowRight size={15} />
          العودة لتسجيل الدخول
        </Link>
      }
    >
      {error && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-6 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200/60 flex items-center justify-center mb-6">
        <ShieldCheck size={28} className="text-brand-600" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-stone-700 mb-2">كلمة المرور الجديدة</label>
          <input
            type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            className="input-luxe"
            placeholder="8 أحرف على الأقل"
            autoComplete="new-password"
            required minLength={8}
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-stone-700 mb-2">تأكيد كلمة المرور</label>
          <input
            type="password" value={password2}
            onChange={e => setPassword2(e.target.value)}
            className="input-luxe"
            placeholder="أعد كلمة المرور الجديدة"
            autoComplete="new-password"
            required minLength={8}
            disabled={submitting}
          />
          {password2 && !passwordsMatch && (
            <p className="text-xs text-red-500 mt-1.5 font-medium">كلمتا المرور غير متطابقتين</p>
          )}
        </div>
        <button
          type="submit"
          disabled={submitting || !passwordsMatch || !longEnough}
          className="btn-primary w-full !py-3.5 !text-base"
        >
          {submitting ? (
            <>
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              جارٍ الحفظ...
            </>
          ) : (
            'حفظ كلمة المرور الجديدة'
          )}
        </button>
      </form>
    </AuthLayout>
  )
}
