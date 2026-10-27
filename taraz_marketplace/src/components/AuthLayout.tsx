import { Link } from 'react-router-dom'
import { ShieldCheck, Truck, FileCheck2, BadgeCheck } from 'lucide-react'
import { LogoFull } from '@/components/Logo'

/**
 * تخطيط المصادقة الفاخر: لوحة بصرية داكنة + نموذج نظيف.
 * يستخدم لصفحات: الدخول، التسجيل، استعادة كلمة المرور.
 */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  quote,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
  quote?: { text: string; author: string }
}) {
  return (
    <div className="min-h-[calc(100vh-113px)] grid lg:grid-cols-5">
      {/* اللوحة البصرية */}
      <aside className="relative hidden lg:flex lg:col-span-2 bg-gradient-to-bl from-ink-950 via-brand-950 to-brand-900 text-white overflow-hidden">
        <div className="absolute inset-0 pattern-diamond pointer-events-none" />
        <div className="glow-gold w-96 h-96 -top-24 -right-24 opacity-60" />
        <div className="glow-emerald w-80 h-80 bottom-0 -left-24 opacity-50" />

        <div className="relative m-auto w-full max-w-sm px-10 py-14">
          <Link to="/" className="inline-block mb-12 hover:opacity-90 transition">
            <LogoFull size={52} light />
          </Link>

          <h2 className="font-display font-black text-3xl leading-snug mb-4">
            {quote?.text ?? 'تسوّق بذوقٍ يليق بك'}
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-10">
            {quote?.author ?? 'طراز — حيث تلتقي الجودة بالثقة، وكل طلب بفاتورة موثقة.'}
          </p>

          <ul className="space-y-4">
            {[
              { icon: ShieldCheck, text: 'دفع آمن ومشفّر بكل الطرق المتاحة' },
              { icon: FileCheck2, text: 'فاتورة ضريبية إلكترونية مع رمز QR للتحقق' },
              { icon: Truck, text: 'توصيل سريع وشحن مجاني فوق 500 ر.س' },
              { icon: BadgeCheck, text: 'تتبع مباشر لكل طلباتك من مكان واحد' },
            ].map(item => (
              <li key={item.text} className="flex items-center gap-3.5 text-sm text-white/75">
                <span className="shrink-0 w-9 h-9 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center">
                  <item.icon size={16} className="text-gold-300" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>

          <div className="mt-12 pt-8 border-t border-white/10 text-[11px] text-white/40 tracking-wide">
            © 2026 TARAZ — جميع الحقوق محفوظة
          </div>
        </div>
      </aside>

      {/* النموذج */}
      <main className="lg:col-span-3 flex items-center justify-center px-4 sm:px-8 py-12 bg-stone-50">
        <div className="w-full max-w-md">
          {/* شعار مصغر للجوال */}
          <div className="lg:hidden mb-8 text-center">
            <Link to="/">
              <LogoFull size={46} />
            </Link>
          </div>

          <div className="card p-8 sm:p-10">
            <h1 className="font-display font-black text-2xl sm:text-[1.7rem] text-stone-900 mb-2">
              {title}
            </h1>
            <p className="text-stone-500 text-sm mb-8 leading-relaxed">{subtitle}</p>

            {children}
          </div>

          {footer && <div className="mt-6 text-center text-sm text-stone-500">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
