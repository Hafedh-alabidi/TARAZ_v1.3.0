import { useState } from 'react'
import { X, CreditCard, ShieldCheck, Lock, AlertTriangle } from 'lucide-react'
import { ordersAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { LogoMark } from '@/components/Logo'
import type { PaymentSession } from '@/api/types'

/**
 * ✅ P0-4 (واجهة): نافذة الدفع الإلكتروني بالبطاقة.
 * في وضع المحاكاة تُعرض البطاقات التجريبية بوضوح مع إعلان صريح أن العملية
 * تجريبية — لا تزوير لانطباع دفع حقيقي. عند تفعيل مويسر الحقيقية تُستبدل
 * بمسارها المستضاف دون تغيير بنية المكوّن.
 */
interface PaymentModalProps {
  session: PaymentSession
  onClose: () => void
  onPaid: (reference: string) => void
}

export default function PaymentModal({ session, onClose, onPaid }: PaymentModalProps) {
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSimulated = session.mode === 'simulated'

  const cardNumberValid = cardNumber.replace(/\s/g, '').length === 16
  const expiryValid = expiry.length === 5 && expiry[2] === '/'
  const cvvValid = cvv.length === 3
  const formValid = cardNumberValid && expiryValid && cvvValid && cardName.trim().length >= 2

  const submit = async () => {
    setProcessing(true)
    setError(null)
    try {
      const res = await ordersAPI.confirmPayment(session.order, {
        session_id: session.session_id,
        card_number: cardNumber.replace(/\s/g, ''),
        card_expiry: expiry,
        card_cvv: cvv,
        card_name: cardName.trim(),
      })
      onPaid(res.reference ?? '')
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="الدفع بالبطاقة">
      <div
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm animate-fade-in"
        onClick={processing ? undefined : onClose}
      />

      <div className="relative bg-white rounded-3xl shadow-float w-full max-w-md max-h-[92vh] overflow-y-auto animate-scale-in">
        {/* شريط الرأس */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-stone-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <LogoMark size={40} />
            <div>
              <h2 className="font-display font-bold text-stone-900">الدفع بالبطاقة</h2>
              <p className="text-[11px] text-stone-400">
                طلب <span className="font-mono" dir="ltr">{session.order_number}</span> ·{' '}
                {session.provider === 'moyasar' ? 'بوابة مويسر' : 'بوابة تجريبية'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition disabled:opacity-40"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* المبلغ */}
          <div className="relative bg-gradient-to-bl from-ink-950 via-brand-950 to-brand-900 text-white rounded-2xl p-5 overflow-hidden">
            <div className="absolute inset-0 pattern-diamond pointer-events-none" />
            <div className="glow-gold w-40 h-40 -top-12 -right-8 opacity-50" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[11px] text-white/60 font-medium mb-1">المبلغ المستحق</p>
                <p className="text-[1.7rem] font-black font-display text-gold-200 tabular-nums" dir="ltr">
                  {parseFloat(session.amount).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                  <span className="text-sm text-white/50 font-sans font-semibold mr-1.5">ر.س</span>
                </p>
              </div>
              <span className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                <CreditCard size={22} className="text-gold-300" />
              </span>
            </div>
          </div>

          {/* إعلان وضع المحاكاة — صدق كامل */}
          {isSimulated && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm text-amber-800 font-bold mb-1.5 flex items-center gap-2">
                <AlertTriangle size={16} /> وضع المحاكاة التجريبي
              </p>
              <p className="text-xs text-amber-700 leading-relaxed mb-3">
                هذه بوابة دفع تجريبية للمعاينة والتدريب — لا يُخصم أي مبلغ حقيقي.
                استخدم إحدى البطاقات التجريبية التالية:
              </p>
              <div className="space-y-1.5">
                {(session.test_cards ?? []).map(tc => (
                  <button
                    key={tc.number}
                    onClick={() => {
                      setCardNumber(tc.number)
                      setExpiry('12/28')
                      setCvv('123')
                      setCardName('بطاقة تجريبية')
                    }}
                    disabled={processing}
                    className="w-full flex items-center justify-between gap-2 bg-white border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs hover:border-amber-400 hover:bg-amber-50/50 transition disabled:opacity-50"
                  >
                    <span dir="ltr" className="font-mono text-stone-700 font-semibold">{tc.number}</span>
                    <span className={`font-bold ${tc.result === 'approved' ? 'text-brand-600' : 'text-red-600'}`}>
                      {tc.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* نموذج البطاقة */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">رقم البطاقة</label>
              <div className="relative">
                <input
                  type="text" dir="ltr" inputMode="numeric" autoComplete="off"
                  value={cardNumber}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 16)
                    setCardNumber(digits.replace(/(.{4})/g, '$1 ').trim())
                  }}
                  placeholder="#### #### #### ####"
                  className="input-luxe text-left font-mono tracking-widest pl-11"
                />
                <CreditCard size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">الاسم على البطاقة</label>
              <input
                type="text" dir="ltr" autoComplete="off"
                value={cardName}
                onChange={e => setCardName(e.target.value)}
                placeholder="AHMED ALMUTAIRI"
                className="input-luxe text-left"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">الصلاحية</label>
                <input
                  type="text" dir="ltr" inputMode="numeric" autoComplete="off"
                  value={expiry}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits)
                  }}
                  placeholder="MM/YY"
                  className="input-luxe text-left font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">CVV</label>
                <input
                  type="password" dir="ltr" inputMode="numeric" autoComplete="off"
                  value={cvv}
                  onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  placeholder="•••"
                  className="input-luxe text-left font-mono"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 font-medium animate-fade-in">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={processing || !formValid}
            className="btn-primary w-full !py-3.5 !text-base"
          >
            {processing ? (
              <>
                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                جارٍ تنفيذ الدفع...
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                ادفع {parseFloat(session.amount).toLocaleString('ar-SA')} ر.س بأمان
              </>
            )}
          </button>

          <p className="text-[11px] text-stone-400 text-center flex items-center justify-center gap-1.5">
            <Lock size={12} />
            لا نخزن بيانات بطاقتك — تُعالج العملية عبر بوابة الدفع
          </p>
        </div>
      </div>
    </div>
  )
}
