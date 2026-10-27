import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, ShoppingCart, Minus, Plus, ChevronLeft, Truck, RotateCcw,
  FileCheck2, ShieldCheck, ImageOff,
} from 'lucide-react'
import ProductCard, { productImage } from '@/components/ProductCard'
import { PageLoader, ErrorState, EmptyState } from '@/components/ui'
import { productsAPI } from '@/api/endpoints'
import { MAX_CART_QTY_PER_PRODUCT } from '@/api/types'
import { useCartStore } from '@/stores/cart'
import { toast } from '@/stores/toast'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { Product } from '@/api/types'

const fmt = (n: number) => n.toLocaleString('ar-SA')

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)

  const addItem = useCartStore(s => s.addItem)
  usePageTitle(
    product ? `${product.name} — طراز` : 'تفاصيل المنتج — طراز',
    product?.description?.slice(0, 155) || 'تفاصيل المنتج والسعر والسياسات في متجر طراز.'
  )

  useEffect(() => {
    window.scrollTo(0, 0)
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setActiveImage(0)
      try {
        const data = await productsAPI.get(parseInt(id!, 10))
        if (!cancelled) setProduct(data)
        // منتجات مشابهة من نفس الفئة
        const relatedRes = await productsAPI.list({
          category: data.category, page_size: 4, ordering: '-created_at',
        })
        if (!cancelled) {
          setRelated(relatedRes.results.filter(p => p.id !== data.id).slice(0, 3))
        }
      } catch {
        if (!cancelled) setError('المنتج غير موجود أو تعذر تحميله')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (id) load()
    return () => { cancelled = true }
  }, [id])

  const handleAddToCart = () => {
    if (!product) return
    const result = addItem({
      productId: product.id,
      name: product.name,
      price: parseFloat(product.price),
      image: productImage(product),
      sku: product.sku,
      // سقف محايد للواجهة — الخادم يتحقق من الكمية الفعلية دائماً
      maxQuantity: MAX_CART_QTY_PER_PRODUCT,
    }, quantity)
    if (result.ok) {
      toast.success(result.message)
      navigate('/cart')
    } else {
      toast.error(result.message)
    }
  }

  // ✅ SEO: بيانات منتج منظمة JSON-LD لمحركات البحث
  useEffect(() => {
    if (!product) return
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'product-jsonld'
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description || product.name,
      sku: product.sku,
      image: product.image_url || product.image || undefined,
      category: product.category_name,
      offers: {
        '@type': 'Offer',
        price: product.price,
        priceCurrency: 'SAR',
        availability: product.availability === 'out_of_stock'
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      },
    })
    document.head.appendChild(script)
    return () => { document.getElementById('product-jsonld')?.remove() }
  }, [product])

  if (loading) return <PageLoader label="جارٍ تحميل المنتج…" />
  if (error) return <div className="container-luxe py-8"><ErrorState message={error} onRetry={() => navigate('/products')} /></div>
  if (!product) return <EmptyState title="المنتج غير موجود" />

  // ✅ حالة التوافر من الخادم — بلا كشف الكميات الداخلية أو بيانات المورد
  const soldOut = product.availability === 'out_of_stock'
  const lowStock = product.availability === 'low_stock'
  const price = parseFloat(product.price)
  const compareAt = product.compare_at_price ? parseFloat(product.compare_at_price) : null
  const discount = product.discount_percent ?? null
  const mainImg = productImage(product)

  // معرض الصور: الرئيسية أولاً ثم صور المعرض
  const gallery: Array<{ src: string; alt: string }> = []
  if (mainImg) gallery.push({ src: mainImg, alt: product.name })
  for (const gi of product.images ?? []) {
    if (gi.image && gi.image !== mainImg) {
      gallery.push({ src: gi.image, alt: gi.alt || product.name })
    }
  }
  const current = gallery[activeImage] ?? gallery[0]

  return (
    <div className="container-luxe py-8 pb-24 md:pb-12">
      {/* مسار التنقل */}
      <nav className="flex items-center gap-1.5 text-[13px] text-stone-400 mb-8 flex-wrap" aria-label="مسار التنقل">
        <Link to="/" className="hover:text-brand-700 transition">الرئيسية</Link>
        <ChevronLeft size={13} className="text-stone-300" />
        <Link to="/products" className="hover:text-brand-700 transition">المنتجات</Link>
        <ChevronLeft size={13} className="text-stone-300" />
        <Link to={`/products?category=${product.category}`} className="hover:text-brand-700 transition">
          {product.category_name}
        </Link>
        <ChevronLeft size={13} className="text-stone-300" />
        <span className="text-ink-900 font-semibold truncate max-w-[220px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16 mb-20">
        {/* المعرض */}
        <div>
          <div className="relative rounded-xl overflow-hidden bg-stone-100 aspect-square border border-stone-200/60">
            {current ? (
              <img
                key={current.src}
                src={current.src}
                alt={current.alt}
                className="w-full h-full object-cover animate-fade-in"
                onError={e => (e.currentTarget.style.display = 'none')}
              />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-300">
                <ImageOff size={48} strokeWidth={1.2} />
                <span className="text-sm">لا توجد صورة لهذا المنتج</span>
              </span>
            )}

            {/* الشارات */}
            <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-2">
              {soldOut ? (
                <span className="bg-ink-900/90 text-white backdrop-blur-sm text-xs font-semibold px-3.5 py-1.5 rounded-md">
                  نفدت الكمية
                </span>
              ) : (
                <>
                  {discount && <span className="badge-sale !text-sm !px-3.5 !py-1.5">خصم {fmt(discount)}٪</span>}
                  {lowStock && (
                    <span className="bg-white/95 text-stone-700 backdrop-blur-sm text-xs font-medium px-3.5 py-1.5 rounded-md border border-stone-200/60">
                      كمية محدودة
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* المصغرات */}
          {gallery.length > 1 && (
            <div className="flex gap-3 mt-4 overflow-x-auto no-scrollbar">
              {gallery.map((g, i) => (
                <button
                  key={g.src}
                  onClick={() => setActiveImage(i)}
                  className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    i === activeImage
                      ? 'border-ink-900'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`عرض الصورة ${i + 1}`}
                  aria-pressed={i === activeImage}
                >
                  <img src={g.src} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* التفاصيل */}
        <div className="flex flex-col">
          <Link
            to={`/products?category=${product.category}`}
            className="self-start text-xs font-medium text-stone-400 hover:text-brand-700 transition tracking-wide mb-3"
          >
            {product.category_name} ←
          </Link>
          <h1 className="font-display font-semibold text-3xl lg:text-[2.5rem] leading-snug text-ink-950 mb-5">
            {product.name}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[2.4rem] font-bold text-ink-950 leading-none tabular-nums">
                {fmt(price)}
              </span>
              <span className="text-stone-400 text-base font-medium">ر.س</span>
              {compareAt && compareAt > price && (
                <span className="price-strike text-lg">{fmt(compareAt)} ر.س</span>
              )}
            </div>
            {discount && (
              <span className="text-[13px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-3 py-1.5 rounded-md">
                توفّر {fmt(compareAt! - price)} ر.س
              </span>
            )}
            {soldOut ? (
              <span className="text-[13px] font-medium text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-md">
                نفدت الكمية
              </span>
            ) : (
              <span className="text-[13px] font-medium text-brand-700 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-soft" />
                متوفر
              </span>
            )}
          </div>

          <p className="text-stone-600 leading-[1.95] mb-8 text-[15px] border-r-2 border-gold-400 pr-4">
            {product.description || 'لا يوجد وصف لهذا المنتج.'}
          </p>

          {/* المعلومات */}
          <div className="grid grid-cols-2 gap-3 mb-8 text-sm">
            <div className="bg-stone-50 border border-stone-200/60 rounded-lg px-4 py-3">
              <span className="text-stone-400 text-xs font-medium">رمز المنتج</span>
              <p className="font-mono font-semibold text-ink-900 mt-0.5" dir="ltr">{product.sku}</p>
            </div>
            <div className="bg-stone-50 border border-stone-200/60 rounded-lg px-4 py-3">
              <span className="text-stone-400 text-xs font-medium">الفئة</span>
              <p className="font-semibold text-ink-900 mt-0.5">{product.category_name}</p>
            </div>
          </div>

          {/* الكمية + الإضافة */}
          {!soldOut && (
            <div className="flex flex-wrap items-center gap-5 mb-7">
              <div
                className="flex items-center bg-white border border-stone-200 rounded-lg overflow-hidden"
                role="group"
                aria-label="اختيار الكمية"
              >
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="p-3 hover:bg-stone-100 transition"
                  aria-label="تقليل الكمية"
                >
                  <Minus size={16} />
                </button>
                <span className="w-14 text-center font-bold text-base tabular-nums" aria-live="polite">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(q => Math.min(MAX_CART_QTY_PER_PRODUCT, q + 1))}
                  className="p-3 hover:bg-stone-100 transition"
                  aria-label="زيادة الكمية"
                >
                  <Plus size={16} />
                </button>
              </div>
              <span className="text-[13px] text-stone-400">
                {lowStock
                  ? 'كمية محدودة — الخادم يؤكد التوفر عند الطلب'
                  : 'الكمية تُؤكد عند إتمام الطلب'}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAddToCart}
              disabled={soldOut}
              className="btn-ink !px-12 flex-1 sm:flex-none"
            >
              <ShoppingCart size={19} />
              {soldOut ? 'غير متوفر حالياً' : 'أضف للسلة'}
            </button>
            <Link to="/products" className="btn-outline !py-3.5">
              متابعة التصفح
            </Link>
          </div>

          {/* سياسات وثقة — قائمة نظيفة بروابط فعلية */}
          <ul className="mt-9 pt-7 border-t border-stone-200/70 space-y-3.5 text-[13.5px] text-stone-600">
            <li className="flex items-center gap-3">
              <Truck size={17} className="text-brand-600 shrink-0" />
              توصيل ٢-٤ أيام عمل — مجاني للطلبات فوق ٥٠٠ ر.س
              <Link to="/shipping-returns" className="link-underline !text-[12.5px] mr-1">التفاصيل</Link>
            </li>
            <li className="flex items-center gap-3">
              <RotateCcw size={17} className="text-brand-600 shrink-0" />
              إرجاع مجاني خلال ١٤ يوماً من الاستلام
              <Link to="/shipping-returns" className="link-underline !text-[12.5px] mr-1">سياسة الإرجاع</Link>
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck size={17} className="text-brand-600 shrink-0" />
              منتج أصلي ١٠٠٪ من مصادر موثوقة
            </li>
            <li className="flex items-center gap-3">
              <FileCheck2 size={17} className="text-brand-600 shrink-0" />
              فاتورة ضريبية إلكترونية مع رمز QR للتحقق مع كل طلب
            </li>
          </ul>
        </div>
      </div>

      {/* منتجات مشابهة */}
      {related.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="eyebrow mb-2.5">قد يعجبك أيضاً</span>
              <h2 className="font-display font-semibold text-2xl md:text-[1.9rem] text-ink-950">منتجات مشابهة</h2>
            </div>
            <Link
              to={`/products?category=${product.category}`}
              className="link-underline hidden sm:inline-flex text-sm"
            >
              عرض الكل
              <ArrowLeft size={15} />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-9">
            {related.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* شريط شراء ثابت للجوال */}
      {!soldOut && (
        <div
          className="md:hidden fixed bottom-[60px] inset-x-0 z-30 bg-white/97 backdrop-blur-md border-t border-stone-200/90 px-4 py-3 flex items-center gap-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] text-stone-400">الإجمالي</span>
            <span className="font-bold text-ink-900 tabular-nums leading-tight">
              {fmt(price * quantity)} ر.س
            </span>
          </div>
          <button
            onClick={handleAddToCart}
            className="btn-ink flex-1 !py-3 !text-[15px]"
          >
            <ShoppingCart size={18} />
            أضف للسلة
          </button>
        </div>
      )}
    </div>
  )
}
