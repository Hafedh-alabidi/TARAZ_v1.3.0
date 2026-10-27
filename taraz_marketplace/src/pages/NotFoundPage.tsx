import { Link } from 'react-router-dom'
import { Home, PackageSearch } from 'lucide-react'
import { LogoMark } from '@/components/Logo'

export default function NotFoundPage() {
  return (
    <div className="relative min-h-[70vh] bg-gradient-to-bl from-ink-950 via-brand-950 to-ink-900 text-white flex items-center justify-center overflow-hidden py-20">
      <div className="absolute inset-0 pattern-diamond pointer-events-none" />
      <div className="glow-gold w-[440px] h-[440px] -top-32 -left-24 opacity-50" />
      <div className="glow-emerald w-[380px] h-[380px] -bottom-24 -right-16 opacity-40" />

      <div className="relative container-luxe text-center">
        <div className="inline-flex mb-8 animate-float-slow">
          <LogoMark size={84} />
        </div>

        <h1 className="font-display font-black text-[6rem] sm:text-[9rem] leading-none mb-2 select-none">
          <span className="text-gradient-gold">404</span>
        </h1>
        <h2 className="font-display font-bold text-2xl sm:text-3xl mb-4">
          هذه الصفحة غير موجودة
        </h2>
        <p className="text-white/60 max-w-md mx-auto leading-relaxed mb-10">
          يبدو أن الرابط الذي تبحث عنه انتقل أو لم يعد متوفراً.
          لا تقلق — متجرنا على بُعد نقرة واحدة.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/" className="btn-gold">
            <Home size={18} />
            العودة للرئيسية
          </Link>
          <Link to="/products" className="btn-ghost-light">
            <PackageSearch size={18} />
            تصفح المنتجات
          </Link>
        </div>
      </div>
    </div>
  )
}
