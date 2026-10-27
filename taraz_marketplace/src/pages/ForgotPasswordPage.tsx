import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, KeyRound, ArrowRight, Inbox } from 'lucide-react'
import { authAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { toast } from '@/stores/toast'
import AuthLayout from '@/components/AuthLayout'

/**
 * ✅ P0-2: طلب استعادة كلمة المرور عبر البريد الإلكتروني.
 * الخادم يعيد رسالة عامة دائماً (منع تعداد المستخدمين).
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await authAPI.requestPasswordReset(email.trim())
      setSent(true)
      toast.success(res.detail || 'أُرسل الطلب بنجاح')
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="نسيت كلمة المرور؟"
      subtitle="أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور — الرابط صالح لمرة واحدة ولمدة 24 ساعة."
      quote={{
        text: 'استعد حسابك بأمان',
        author: 'روابط أحادية الاستخدام تنتهي صلاحيتها تلقائياً — أمانك أولويتنا.',
      }}
      footer={
        <Link to="/login" className="text-brand-700 font-bold hover:underline inline-flex items-center gap-1.5">
          <ArrowRight size={15} />
          العودة لتسجيل الدخول
        </Link>
      }
    >
      {sent ? (
        <div className="text-center space-y-6 animate-scale-in">
          <div className="relative inline-flex items-center justify-center mb-2">
            <div className="absolute inset-0 rounded-full bg-brand-100/70 blur-xl" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200/60 flex items-center justify-center">
              <Inbox size={36} className="text-brand-600" />
            </div>
          </div>
          <div className="bg-brand-50/70 border border-brand-200/70 rounded-2xl p-6 text-right">
            <p className="text-brand-800 font-bold mb-2 flex items-center gap-2">
              <Mail size={18} />
              أُرسل الطلب
            </p>
            <p className="text-sm text-brand-900/70 leading-relaxed">
              إن كان البريد <span className="font-bold" dir="ltr">{email}</span> مسجلاً لدينا
              فستصلك رسالة تحتوي رابط إعادة التعيين خلال دقائق.
              تأكد من مجلد البريد المزعج (Spam) إن لم تجدها.
            </p>
          </div>
          <button
            onClick={() => { setSent(false); setEmail('') }}
            className="text-brand-600 text-sm font-bold hover:underline"
          >
            إرسال الطلب مجدداً لبريد آخر
          </button>
        </div>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200/60 flex items-center justify-center mb-6">
            <KeyRound size={28} className="text-brand-600" />
          </div>

          {error && (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-6 text-sm font-medium">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">البريد الإلكتروني</label>
              <div className="relative">
                <input
                  type="email" dir="ltr" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-luxe text-left pl-11"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full !py-3.5 !text-base"
            >
              {submitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  جارٍ الإرسال...
                </>
              ) : (
                <>
                  <Mail size={19} />
                  إرسال رابط الاستعادة
                </>
              )}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
