import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Mail, Phone, Clock, MapPin, CreditCard, Send, Check,
} from 'lucide-react'
import { useConfigStore } from '@/stores/config'
import { LogoMark } from '@/components/Logo'
import { toast } from '@/stores/toast'

/** بيانات التواصل الاحتياطية — تُستخدم فقط إن تعذّر تحميل إعدادات الخادم */
const SUPPORT_EMAIL = 'DigitalCreativityteam5@gmail.com'
const SUPPORT_PHONE = '00967 777279161'
/** تحويل رقم العرض إلى صيغة دولية صالحة للاتصال المباشر: 00967… → +967… */
const telHref = (phone?: string) =>
  `tel:${(phone ?? SUPPORT_PHONE).replace(/[^\d+]/g, '').replace(/^00/, '+')}`

/**
 * تذييل طراز التحريري —
 * 1) روابط الدعم والصفحات القانونية تؤدي لصفحات فعلية (لا mailto وهمية)
 * 2) بيانات التواصل تُقرأ من إعدادات الخادم الحقيقية
 * 3) شعارات وسائل الدفع تظهر فقط عند تفعيلها فعلياً — لا ادعاء زائف
 * 4) نشرة بريدية اختيارية بتأكيد واضح (لا تخزين بيانات إلا بموافقة)
 */
export default function Footer() {
  const config = useConfigStore(s => s.config)
  const support = config?.support
  const payment = config?.payment
  const storeName = config?.store_name ?? 'متجر طراز'
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error('يرجى إدخال بريد إلكتروني صحيح')
      return
    }
    // معاينة محلية — في الإنتاج ترتبط بخدمة نشرة بريدية فعلية
    setSubscribed(true)
    setEmail('')
    toast.success('تم تسجيل بريدك في نشرة طراز — ستصلنا أولاً بأول')
  }

  const supportLinks = [
    { to: '/faq', label: 'الأسئلة الشائعة' },
    { to: '/contact', label: 'اتصل بنا' },
    { to: '/shipping-returns', label: 'الشحن والاسترجاع' },
    { to: '/privacy', label: 'سياسة الخصوصية' },
    { to: '/terms', label: 'الشروط والأحكام' },
  ]

  const shopLinks = [
    { to: '/products', label: 'كل المنتجات' },
    { to: '/products?on_sale=1', label: 'العروض والتخفيضات' },
    { to: '/cart', label: 'سلة التسوق' },
    { to: '/orders', label: 'طلباتي' },
    { to: '/register', label: 'إنشاء حساب' },
  ]

  return (
    <footer className="relative bg-ink-950 text-stone-300 mt-20">
      {/* حد علوي ذهبي شعري */}
      <div className="h-px bg-gradient-to-l from-transparent via-gold-500/60 to-transparent" />

      <div className="relative container-luxe pt-14 pb-8">
        {/* صف النشرة البريدية */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-12 mb-12 border-b border-white/[0.07]">
          <div className="max-w-md">
            <h3 className="font-display font-semibold text-xl text-white mb-2">
              كن أول من يعرف بالعروض
            </h3>
            <p className="text-sm text-stone-400 leading-relaxed">
              نشرة طراز تصلك بالتخفيضات والمنتجات الجديدة — بلا إزعاج، ويمكنك
              إلغاء الاشتراك في أي وقت.
            </p>
          </div>
          {subscribed ? (
            <div className="flex items-center gap-3 text-brand-300 bg-brand-950/40 border border-brand-800/50 rounded-xl px-5 py-4">
              <span className="w-8 h-8 rounded-full bg-brand-900 flex items-center justify-center shrink-0">
                <Check size={16} />
              </span>
              <div>
                <p className="font-semibold text-sm text-white">تم تسجيل اشتراكك بنجاح</p>
                <p className="text-xs text-stone-400 mt-0.5">أهلاً بك في عائلة طراز</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex w-full lg:w-96 gap-2">
              <div className="relative flex-1">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="بريدك الإلكتروني"
                  className="input-luxe !bg-white/[0.06] !border-white/15 !text-white placeholder:!text-stone-500 focus:!border-brand-400 !rounded-lg"
                  aria-label="البريد الإلكتروني للنشرة"
                  dir="ltr"
                />
              </div>
              <button type="submit" className="btn-gold !py-3 !px-6 !text-sm shrink-0">
                <Send size={15} />
                اشترك
              </button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 mb-12">
          {/* العلامة */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3 mb-5">
              <LogoMark size={42} />
              <div className="leading-none">
                <div className="font-display font-semibold text-2xl text-white">طراز</div>
                <div className="text-[10px] text-gold-300/60 mt-1 tracking-[0.3em]">TARAZ</div>
              </div>
            </div>
            <p className="text-stone-400 text-sm leading-[1.9] max-w-xs mb-6">
              {storeName} — منصة تجارة إلكترونية متكاملة بإدارة مخزون ونقطة بيع.
              جودة موثوقة، توصيل سريع، وفاتورة ضريبية إلكترونية لكل طلب.
            </p>
            <ul className="space-y-2.5 text-[13px] text-stone-400">
              <li className="flex items-center gap-2.5">
                <span className="w-1 h-1 rounded-full bg-gold-500/70" />
                دفع آمن ومشفّر
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-1 h-1 rounded-full bg-gold-500/70" />
                شحن مجاني فوق ٥٠٠ ر.س
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-1 h-1 rounded-full bg-gold-500/70" />
                إرجاع مجاني خلال ١٤ يوماً
              </li>
            </ul>
          </div>

          {/* التسوق */}
          <div className="lg:col-span-2">
            <h3 className="font-display font-semibold text-[15px] mb-5 text-gold-300">التسوق</h3>
            <ul className="space-y-3.5 text-sm">
              {shopLinks.map(l => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-stone-400 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* الدعم */}
          <div className="lg:col-span-2">
            <h3 className="font-display font-semibold text-[15px] mb-5 text-gold-300">
              الدعم والقانون
            </h3>
            <ul className="space-y-3.5 text-sm">
              {supportLinks.map(l => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-stone-400 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* التواصل */}
          <div className="lg:col-span-4">
            <h3 className="font-display font-semibold text-[15px] mb-5 text-gold-300">تواصل معنا</h3>
            <ul className="space-y-4 text-sm">
              <li>
                <a
                  href={`mailto:${support?.email ?? SUPPORT_EMAIL}`}
                  className="flex items-center gap-3 text-stone-400 hover:text-white transition group"
                >
                  <span className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 group-hover:border-gold-500/40 transition">
                    <Mail size={15} className="text-gold-300" />
                  </span>
                  <span dir="ltr" className="truncate">{support?.email ?? SUPPORT_EMAIL}</span>
                </a>
              </li>
              <li>
                <a
                  href={telHref(support?.phone)}
                  className="flex items-center gap-3 text-stone-400 hover:text-white transition group"
                >
                  <span className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 group-hover:border-gold-500/40 transition">
                    <Phone size={15} className="text-gold-300" />
                  </span>
                  <span dir="ltr" className="tracking-wide">{support?.phone ?? SUPPORT_PHONE}</span>
                </a>
              </li>
              <li className="flex items-center gap-3 text-stone-400">
                <span className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                  <Clock size={15} className="text-gold-300" />
                </span>
                {support?.hours ?? 'السبت - الخميس: 9ص - 9م'}
              </li>
              <li className="flex items-center gap-3 text-stone-400">
                <span className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                  <MapPin size={15} className="text-gold-300" />
                </span>
                الجمهورية اليمنية
              </li>
            </ul>
          </div>
        </div>

        {/* الشريط السفلي */}
        <div className="border-t border-white/[0.07] pt-7 flex flex-col md:flex-row items-center justify-between gap-5 text-[13px] text-stone-500">
          <p>© 2026 طراز — جميع الحقوق محفوظة.</p>

          {/* ✅ شعارات صادقة: تظهر فقط عند التفعيل الفعلي */}
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            {payment?.card_enabled ? (
              <>
                <PaymentBadge label="جيب" />
                <PaymentBadge label="Visa" />
                <PaymentBadge label="Mastercard" />
                {payment.simulated && (
                  <span className="text-[11px] font-semibold text-gold-200 bg-gold-500/10 border border-gold-400/30 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-300 animate-pulse-soft" />
                    بوابة معاينة تجريبية
                  </span>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-2 text-xs text-stone-400">
                <CreditCard size={14} className="text-gold-300" />
                الدفع عند الاستلام أو تحويل بنكي
              </span>
            )}
          </div>

          <p className="text-xs text-stone-600">صُنع بإتقان في الجمهورية اليمنية</p>
        </div>
      </div>
    </footer>
  )
}

function PaymentBadge({ label }: { label: string }) {
  return (
    <span className="bg-white/[0.05] border border-white/10 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide hover:border-gold-500/40 transition">
      {label}
    </span>
  )
}
