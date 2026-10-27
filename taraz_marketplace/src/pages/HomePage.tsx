import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ShieldCheck, Truck, CreditCard, Headphones, QrCode, Sparkles,
} from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { ProductsSkeleton, EmptyState } from '@/components/ui'
import { productsAPI, categoriesAPI } from '@/api/endpoints'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { Product, Category } from '@/api/types'

const fmt = (n: number) => n.toLocaleString('ar-SA')

export default function HomePage() {
  usePageTitle('طراز — تسوّق بذوقٍ يليق بك', 'متجر طراز: منتجات أصلية مختارة بعناية مع توصيل سريع داخل الجمهورية اليمنية، دفع آمن، وفاتورة ضريبية إلكترونية لكل طلب.')
  const [featured, setFeatured] = useState<Product[]>([])
  const [onSale, setOnSale] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryImages, setCategoryImages] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [productsRes, saleRes, categoriesRes, allRes] = await Promise.all([
          productsAPI.list({ page_size: 8, ordering: '-created_at' }),
          productsAPI.list({ page_size: 4, ordering: '-discount_percent', on_sale: true }),
          categoriesAPI.list(),
          productsAPI.list({ page_size: 40 }),
        ])
        if (!cancelled) {
          setFeatured(productsRes.results)
          setOnSale(saleRes.results)
          setCategories(categoriesRes)
          // أول صورة منتج لكل فئة — لبطاقات الفئات
          const imgs: Record<number, string> = {}
          for (const p of allRes.results) {
            const img = p.image_url || p.image
            if (img && !imgs[p.category]) imgs[p.category] = img
          }
          setCategoryImages(imgs)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const maxDiscount = onSale.reduce(
    (max, p) => Math.max(max, p.discount_percent ?? 0), 0)

  return (
    <div>
      {/* ==================== البطل — توزيع تحريري هادئ ==================== */}
      <section className="relative bg-[#f4f1ea] overflow-hidden">
        <div className="absolute inset-0 pattern-dots opacity-60 pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-gold-200/25 blur-3xl pointer-events-none" />

        <div className="relative container-luxe py-14 md:py-20 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* النص */}
            <div className="text-center lg:text-right">
              <span className="eyebrow mb-5 animate-fade-up">وجهة التسوق المختارة</span>

              <h1 className="font-display font-semibold text-[2.6rem] sm:text-6xl lg:text-[3.6rem] leading-[1.15] text-ink-950 mb-6 animate-fade-up stagger-1">
                كل ما يليق بذوقك،
                <br />
                <span className="text-gradient-gold">في مكانٍ واحد</span>
              </h1>

              <p className="text-stone-500 text-base sm:text-lg leading-[2] max-w-md mx-auto lg:mx-0 mb-9 animate-fade-up stagger-2">
                منتجات أصلية مختارة بعناية من خمس فئات، بسعرٍ عادل وشفاف —
                مع توصيل سريع لكل محافظات الجمهورية اليمنية وفاتورة ضريبية موثقة لكل طلب.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6 mb-10 animate-fade-up stagger-3">
                <Link to="/products" className="btn-ink w-full sm:w-auto !py-3.5">
                  تسوّق الآن
                  <ArrowLeft size={18} />
                </Link>
                <Link to="/products?on_sale=1" className="link-underline w-full sm:w-auto justify-center">
                  <Sparkles size={15} className="text-gold-600" />
                  استعرض العروض
                </Link>
              </div>

              {/* ثقة نصية هادئة — بلا صناديق */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-7 gap-y-3 text-[13px] text-stone-500 animate-fade-up stagger-4">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck size={15} className="text-brand-600" />
                  منتجات أصلية
                </span>
                <span className="w-px h-4 bg-stone-300/70 hidden sm:block" />
                <span className="inline-flex items-center gap-2">
                  <Truck size={15} className="text-brand-600" />
                  شحن مجاني فوق ٥٠٠ ر.س
                </span>
                <span className="w-px h-4 bg-stone-300/70 hidden sm:block" />
                <span className="inline-flex items-center gap-2">
                  <QrCode size={15} className="text-brand-600" />
                  فاتورة ضريبية إلكترونية لكل طلب
                </span>
              </div>
            </div>

            {/* الصورة التحريرية — قوس معماري بحلقة ذهبية */}
            <div className="relative mx-auto w-full max-w-[350px] sm:max-w-[430px] lg:max-w-none">
              <div className="absolute -inset-3 sm:-inset-4 rounded-t-[999px] rounded-b-[2rem] border border-gold-400/50 pointer-events-none" />
              <div className="relative rounded-t-[999px] rounded-b-[1.75rem] overflow-hidden bg-stone-200 aspect-[4/5] shadow-float">
                <img
                  src="/branding/hero.png"
                  alt="مجموعة منتجات طراز المختارة بأسلوب تحريري"
                  className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/25 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* شريحة سعر عائمة — منتج حقيقي */}
              {onSale[0] && (
                <Link
                  to={`/products/${onSale[0].id}`}
                  className="absolute bottom-5 right-4 sm:-right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-float border border-stone-200/60 px-4 py-3 flex items-center gap-3 hover:bg-white transition-colors animate-fade-up stagger-5"
                >
                  <span className="w-11 h-11 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                    {(onSale[0].image_url || onSale[0].image) && (
                      <img
                        src={onSale[0].image_url || onSale[0].image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[11px] text-stone-400 line-clamp-1 max-w-[130px]">
                      {onSale[0].name}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink-900 tabular-nums">
                        {fmt(parseFloat(onSale[0].price))} ر.س
                      </span>
                      {onSale[0].discount_percent && (
                        <span className="badge-sale">-{fmt(onSale[0].discount_percent)}٪</span>
                      )}
                    </span>
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== شريط الثقة — نصي شعري ==================== */}
      <section className="bg-white border-b border-stone-200/70">
        <div className="container-luxe py-7 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
          {[
            { icon: ShieldCheck, title: 'منتجات أصلية', desc: 'مصادر موثوقة وضمان الوكيل' },
            { icon: Truck, title: 'توصيل سريع', desc: '٢-٤ أيام عمل لكل المحافظات' },
            { icon: CreditCard, title: 'دفع آمن', desc: 'جيب وبطاقات ائتمانية مشفّرة' },
            { icon: Headphones, title: 'دعم حقيقي', desc: 'خدمة عملاء ٧ أيام بالأسبوع' },
          ].map((f, i) => (
            <div
              key={f.title}
              className={`flex items-center gap-3.5 ${i > 0 ? 'lg:border-r lg:border-stone-200/70 lg:pr-6' : ''}`}
            >
              <f.icon size={22} strokeWidth={1.5} className="text-brand-600 shrink-0" />
              <div>
                <h3 className="font-display font-semibold text-[15px] text-ink-900">{f.title}</h3>
                <p className="text-xs text-stone-500 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== الفئات — بطاقات مصوّرة ==================== */}
      {categories.length > 0 && (
        <section className="section">
          <div className="container-luxe">
            <div className="flex items-end justify-between gap-4 mb-9">
              <div>
                <span className="eyebrow mb-2.5">تصفّح بسهولة</span>
                <h2 className="font-display font-semibold text-2xl md:text-[2.1rem] text-ink-950">
                  تسوّق حسب الفئة
                </h2>
              </div>
              <Link to="/products" className="link-underline hidden sm:inline-flex text-sm">
                كل المنتجات
                <ArrowLeft size={15} />
              </Link>
            </div>

            <div className="flex lg:grid lg:grid-cols-5 gap-4 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5 lg:mx-0 lg:px-0 lg:overflow-visible">
              {categories.map((cat, i) => (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.id}`}
                  className={`group relative shrink-0 w-36 sm:w-44 lg:w-auto aspect-[4/5] rounded-xl overflow-hidden bg-stone-200 animate-fade-up stagger-${Math.min(i + 1, 5)}`}
                >
                  {categoryImages[cat.id] ? (
                    <img
                      src={categoryImages[cat.id]}
                      alt={cat.name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-stone-100 to-stone-200 pattern-dots" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/75 via-ink-950/15 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-4">
                    <h3 className="font-display font-semibold text-white text-base">{cat.name}</h3>
                    {typeof cat.products_count === 'number' && (
                      <p className="text-[11px] text-white/70 mt-1">
                        {fmt(cat.products_count)} منتجاً
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ==================== وصل حديثاً ==================== */}
      <section className="section pt-0">
        <div className="container-luxe">
          <div className="flex items-end justify-between gap-4 mb-9">
            <div>
              <span className="eyebrow mb-2.5">مختارات جديدة</span>
              <h2 className="font-display font-semibold text-2xl md:text-[2.1rem] text-ink-950">
                وصل حديثاً
              </h2>
            </div>
            <Link to="/products" className="link-underline hidden sm:inline-flex text-sm">
              عرض الكل
              <ArrowLeft size={15} />
            </Link>
          </div>

          {loading ? (
            <ProductsSkeleton />
          ) : featured.length === 0 ? (
            <EmptyState title="لا توجد منتجات حالياً" subtitle="أضف منتجات من لوحة الإدارة" />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {featured.map((product, i) => (
                <div key={product.id} className={`animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}

          <div className="sm:hidden mt-9 text-center">
            <Link to="/products" className="btn-outline">
              عرض كل المنتجات
              <ArrowLeft size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ==================== العروض — شريط تحريري داكن ==================== */}
      {onSale.length > 0 && (
        <section className="relative bg-ink-950 text-white overflow-hidden">
          <div className="absolute inset-0 pattern-diamond pointer-events-none" />
          <div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />

          <div className="relative container-luxe py-14 md:py-16">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
              <div>
                <span className="eyebrow !text-gold-400 mb-2.5">وفّر أكثر</span>
                <h2 className="font-display font-semibold text-2xl md:text-[2.1rem] text-white">
                  عروض طراز
                  {maxDiscount > 0 && (
                    <span className="text-gradient-gold"> — حتى {fmt(maxDiscount)}٪ خصماً</span>
                  )}
                </h2>
                <p className="text-stone-400 text-sm mt-3 max-w-lg leading-relaxed">
                  خصومات موثقة من سعر ما قبل الخصم الفعلي — لا أسعار وهمية ولا
                  عدّادات زائفة. ما تراه هو ما تدفعه.
                </p>
              </div>
              <Link to="/products?on_sale=1" className="btn-gold shrink-0">
                كل العروض
                <ArrowLeft size={17} />
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {onSale.map((product, i) => (
                <div key={product.id} className={`animate-fade-up stagger-${Math.min(i + 1, 4)}`}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ==================== الفاتورة الضريبية الإلكترونية — شريط هادئ ==================== */}
      <section className="bg-white border-y border-stone-200/70">
        <div className="container-luxe py-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <span className="shrink-0 w-14 h-14 rounded-xl bg-ink-950 text-gold-300 flex items-center justify-center">
            <QrCode size={26} strokeWidth={1.5} />
          </span>
          <div className="text-center sm:text-right flex-1">
            <h2 className="font-display font-semibold text-lg text-ink-950 mb-1">
              فاتورة ضريبية إلكترونية لكل طلب — برمز QR للتحقق
            </h2>
            <p className="text-[13px] text-stone-500 leading-relaxed max-w-2xl">
              كل طلب يصدر برقم فاتورة رسمي ورمز QR قابل للتحقق من مصلحة
              الضرائب، بترميز TLV معتمد يضم بيانات البائع والرقم
              الضريبي وإجمالي الضريبة.
            </p>
          </div>
          <Link to="/faq" className="link-underline text-sm shrink-0">
            كيف أتحقق من فاتورتي؟
          </Link>
        </div>
      </section>

      {/* ==================== دعوة ختامية هادئة ==================== */}
      <section className="section">
        <div className="container-luxe text-center max-w-2xl mx-auto">
          <span className="eyebrow justify-center mb-4">ابدأ اليوم</span>
          <h2 className="font-display font-semibold text-3xl md:text-4xl text-ink-950 mb-4 leading-snug">
            تجربة تسوّق من طرازٍ آخر
          </h2>
          <p className="text-stone-500 leading-[1.9] mb-8">
            حساب مجاني خلال دقيقة — تابع طلباتك، احتفظ بفواتيرك، وكن أول من
            يعرف بالتخفيضات عبر نشرة طراز.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="btn-ink">
              أنشئ حسابك مجاناً
              <ArrowLeft size={17} />
            </Link>
            <Link to="/products" className="link-underline">
              تصفّح المنتجات أولاً
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
