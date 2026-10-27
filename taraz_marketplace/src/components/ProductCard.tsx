import { Link } from 'react-router-dom'
import { Plus, ImageOff } from 'lucide-react'
import type { Product } from '@/api/types'
import { MAX_CART_QTY_PER_PRODUCT } from '@/api/types'
import { useCartStore } from '@/stores/cart'
import { toast } from '@/stores/toast'

interface ProductCardProps {
  product: Product
}

/** الصورة الفعلية: الملف المرفوع أولاً ثم الرابط الخارجي */
export function productImage(product: Product): string {
  return product.image_url || product.image || ''
}

export default function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore(s => s.addItem)

  const handleAddToCart = () => {
    const result = addItem({
      productId: product.id,
      name: product.name,
      price: parseFloat(product.price),
      image: productImage(product),
      sku: product.sku,
      // الكمية الفعلية يتحقق منها الخادم — الواجهة تعرض سقفاً محايداً
      maxQuantity: MAX_CART_QTY_PER_PRODUCT,
    })
    if (result.ok) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  // ✅ الحالة من الخادم بدون كشف الكميات الداخلية
  const soldOut = product.availability === 'out_of_stock'
  const lowStock = product.availability === 'low_stock'
  const img = productImage(product)
  const price = parseFloat(product.price)
  const compareAt = product.compare_at_price ? parseFloat(product.compare_at_price) : null
  const discount = product.discount_percent ?? null
  const fmt = (n: number) => n.toLocaleString('ar-SA')

  return (
    <div className="group relative flex flex-col">
      {/* الصورة — نسبة مربعة موحدة لكل البطاقات */}
      <Link
        to={`/products/${product.id}`}
        className="relative block overflow-hidden rounded-xl bg-stone-100 aspect-square"
        aria-label={product.name}
      >
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            width={600}
            height={600}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
            onError={e => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-300">
            <ImageOff size={32} strokeWidth={1.5} />
            <span className="text-[11px] font-medium">صورة قادمة</span>
          </span>
        )}

        {/* الشارات — أعلى اليسار، صغيرة وهادئة */}
        <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <span className="bg-ink-900/90 text-white backdrop-blur-sm text-[11px] font-semibold px-2.5 py-1 rounded-md">
              نفدت الكمية
            </span>
          ) : (
            <>
              {discount && <span className="badge-sale">خصم {fmt(discount)}٪</span>}
              {lowStock && (
                <span className="bg-white/95 text-stone-700 backdrop-blur-sm text-[11px] font-medium px-2.5 py-1 rounded-md border border-stone-200/60">
                  كمية محدودة
                </span>
              )}
            </>
          )}
        </div>

        {/* زر الإضافة السريعة — يظهر عند التحويم على الشاشات الكبيرة */}
        {!soldOut && (
          <button
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              handleAddToCart()
            }}
            className="hidden md:flex absolute bottom-3 inset-x-3 z-10 items-center justify-center gap-2 bg-white/95 backdrop-blur-sm text-ink-900 text-sm font-semibold py-3 rounded-lg shadow-luxe border border-stone-200/50 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white"
            aria-label={`أضف ${product.name} إلى السلة`}
          >
            <Plus size={16} />
            إضافة سريعة للسلة
          </button>
        )}
      </Link>

      {/* المحتوى — مسافات مريحة وتسلسل واضح */}
      <div className="pt-4 pb-1 px-0.5 flex flex-col flex-1">
        <span className="text-[11px] font-medium text-stone-500 tracking-wide mb-1.5">
          {product.category_name}
        </span>
        <Link to={`/products/${product.id}`} className="block">
          <h3 className="text-[15px] font-semibold text-stone-800 leading-relaxed line-clamp-2 min-h-[3.2rem] hover:text-brand-700 transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* السعر + زر الجوال — صف مريح بلا تداخل: السعر يتمدد والزر ثابت 44px */}
        <div className="mt-3 flex items-center justify-between gap-2.5">
          <div className="flex flex-col min-w-0">
            {compareAt && compareAt > price && (
              <span className="price-strike text-[11px] mb-0.5 leading-tight truncate max-w-[110px]">
                {fmt(compareAt)} ر.س
              </span>
            )}
            <span className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-ink-900 tabular-nums leading-none">
                {fmt(price)}
              </span>
              <span className="text-[11px] text-stone-400 font-medium">ر.س</span>
            </span>
          </div>

          {/* زر إضافة الجوال — هدف لمس 44px معزول تماماً عن السعر */}
          {!soldOut && (
            <button
              onClick={handleAddToCart}
              className="md:hidden shrink-0 h-11 w-11 rounded-full bg-ink-900 text-white flex items-center justify-center active:scale-95 transition-transform"
              aria-label={`أضف ${product.name} إلى السلة`}
            >
              <Plus size={18} />
            </button>
          )}
          {soldOut && (
            <span className="md:hidden shrink-0 h-9 px-3 rounded-full bg-stone-100 text-stone-500 text-[11px] font-medium flex items-center">
              غير متوفر
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
