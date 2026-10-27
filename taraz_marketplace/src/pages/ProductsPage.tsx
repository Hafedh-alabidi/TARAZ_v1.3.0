import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, BadgePercent } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { ProductsSkeleton, EmptyState, ErrorState } from '@/components/ui'
import { productsAPI, categoriesAPI } from '@/api/endpoints'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { Product, Category } from '@/api/types'

const ORDERING_OPTIONS = [
  { value: '-created_at', label: 'الأحدث' },
  { value: 'price', label: 'السعر: الأقل أولاً' },
  { value: '-price', label: 'السعر: الأعلى أولاً' },
  { value: 'name', label: 'الاسم أ-ي' },
]

const PAGE_SIZE = 12

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('search') ?? ''
  const categoryParam = searchParams.get('category') ?? ''
  const onSale = searchParams.get('on_sale') === '1'
  const ordering = searchParams.get('ordering') ?? '-created_at'
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(search)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeCategory = categories.find(c => String(c.id) === categoryParam)
  usePageTitle(
    onSale ? 'العروض والتخفيضات — طراز'
      : activeCategory ? `${activeCategory.name} — طراز`
        : 'كل المنتجات — طراز',
    'تصفح منتجات طراز الأصلية بأسعار شفافة — فلاتر فعالة وترتيب حسب السعر أو الأحدث.'
  )

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await productsAPI.list({
        search: search || undefined,
        category: categoryParam ? parseInt(categoryParam, 10) : undefined,
        ordering,
        page,
        page_size: PAGE_SIZE,
        on_sale: onSale || undefined,
      })
      setProducts(data.results)
      setCount(data.count)
    } catch {
      setError('تعذر تحميل المنتجات — تحقق من الاتصال')
    } finally {
      setLoading(false)
    }
  }, [search, categoryParam, ordering, page, onSale])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    categoriesAPI.list().then(setCategories).catch(() => {})
  }, [])

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    })
    setSearchParams(next)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ search: searchInput.trim() || null, page: null })
  }

  const totalPages = Math.ceil(count / PAGE_SIZE)
  const fmt = (n: number) => n.toLocaleString('ar-SA')

  const categoryButton = (active: boolean) =>
    `w-full text-right px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-between gap-2 ${
      active
        ? 'bg-ink-900 text-white'
        : 'text-stone-600 hover:bg-stone-100 hover:text-ink-900'
    }`

  return (
    <div>
      {/* ترويسة الصفحة — فاتحة وهادئة */}
      <div className="bg-white border-b border-stone-200/70">
        <div className="relative container-luxe py-10 md:py-12 overflow-hidden">
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-gold-100/50 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <span className="eyebrow mb-2.5">
                {onSale ? 'وفّر أكثر' : 'مجموعة مختارة بعناية'}
              </span>
              <h1 className="font-display font-semibold text-3xl md:text-4xl text-ink-950 mb-2">
                {onSale
                  ? 'العروض والتخفيضات'
                  : activeCategory
                    ? activeCategory.name
                    : 'كل المنتجات'}
              </h1>
              <p className="text-stone-500 text-sm">
                {loading
                  ? 'جارٍ جمع المنتجات…'
                  : `${fmt(count)} منتجاً متاحاً${search ? ` لبحث «${search}»` : ''}${onSale ? ' بأسعار مخفضة' : ''}`}
              </p>
            </div>
            <form onSubmit={handleSearch} className="flex gap-2 w-full lg:w-80">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="ابحث ضمن النتائج…"
                  className="input-luxe !rounded-lg pr-11"
                  aria-label="البحث"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-md text-stone-400 hover:text-brand-700 transition-colors"
                  aria-label="بحث"
                >
                  <Search size={17} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="container-luxe py-8 md:py-10">
        {/* شريط الفلاتر للجوال */}
        <div className="lg:hidden mb-6">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="w-full flex items-center justify-between bg-white border border-stone-200/80 rounded-lg px-4 py-3 text-sm font-medium text-stone-700"
            aria-expanded={filtersOpen}
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-brand-600" />
              تصفية النتائج
              {(categoryParam || onSale) && (
                <span className="w-5 h-5 rounded-full bg-ink-900 text-white text-[10px] font-bold flex items-center justify-center">
                  {(categoryParam ? 1 : 0) + (onSale ? 1 : 0)}
                </span>
              )}
            </span>
            <ChevronRight
              size={16}
              className={`text-stone-400 transition-transform ${filtersOpen ? 'rotate-90' : ''}`}
            />
          </button>
          {filtersOpen && (
            <div className="mt-3 card p-4 animate-slide-down">
              <button
                onClick={() => updateParams({ on_sale: onSale ? null : '1', page: null })}
                className={`${categoryButton(onSale)} mb-1.5`}
              >
                <span className="flex items-center gap-2">
                  <BadgePercent size={15} />
                  العروض فقط
                </span>
              </button>
              <div className="h-px bg-stone-100 my-3" />
              <div className="space-y-1">
                <button
                  onClick={() => updateParams({ category: null, page: null })}
                  className={categoryButton(!categoryParam)}
                >
                  كل الفئات
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => updateParams({ category: String(cat.id), page: null })}
                    className={categoryButton(categoryParam === String(cat.id))}
                  >
                    <span>{cat.name}</span>
                    {typeof cat.products_count === 'number' && (
                      <span className={`text-[11px] ${categoryParam === String(cat.id) ? 'text-white/60' : 'text-stone-400'}`}>
                        {fmt(cat.products_count)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* الفلاتر الجانبية — سطح المكتب */}
          <aside className="lg:w-60 shrink-0 hidden lg:block">
            <div className="sticky top-32">
              <h3 className="font-display font-semibold text-[15px] text-ink-900 mb-4 flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-brand-600" />
                تصفية النتائج
              </h3>
              <div className="space-y-1 mb-6">
                <button
                  onClick={() => updateParams({ on_sale: onSale ? null : '1', page: null })}
                  className={categoryButton(onSale)}
                >
                  <span className="flex items-center gap-2">
                    <BadgePercent size={15} />
                    العروض فقط
                  </span>
                </button>
              </div>
              <div className="h-px bg-stone-200/70 mb-4" />
              <div className="space-y-1">
                <button
                  onClick={() => updateParams({ category: null, page: null })}
                  className={categoryButton(!categoryParam)}
                >
                  كل الفئات
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => updateParams({ category: String(cat.id), page: null })}
                    className={categoryButton(categoryParam === String(cat.id))}
                  >
                    <span>{cat.name}</span>
                    {typeof cat.products_count === 'number' && (
                      <span className={`text-[11px] ${categoryParam === String(cat.id) ? 'text-white/60' : 'text-stone-400'}`}>
                        {fmt(cat.products_count)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* الشبكة */}
          <div className="flex-1 min-w-0">
            {/* الترتيب + العدد */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-7 pb-5 border-b border-stone-200/70">
              <p className="text-stone-500 text-sm">
                {loading ? (
                  <span className="inline-block w-24 skeleton h-4" />
                ) : (
                  <>
                    عرض <b className="text-ink-900 font-semibold">{fmt(products.length)}</b> من{' '}
                    <b className="text-ink-900 font-semibold">{fmt(count)}</b> منتجاً
                  </>
                )}
              </p>
              <label className="flex items-center gap-2 text-sm text-stone-500">
                ترتيب حسب
                <select
                  value={ordering}
                  onChange={e => updateParams({ ordering: e.target.value, page: null })}
                  className="input-luxe !w-auto !py-2 !px-3 text-sm font-medium !rounded-lg"
                  aria-label="ترتيب النتائج"
                >
                  {ORDERING_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <ProductsSkeleton count={9} />
            ) : error ? (
              <ErrorState message={error} onRetry={loadProducts} />
            ) : products.length === 0 ? (
              <EmptyState
                title="لا توجد نتائج"
                subtitle={
                  search
                    ? `لم نجد نتائج لـ «${search}» — جرّب كلمات أخرى أو أزل الفلاتر`
                    : 'لا توجد منتجات مطابقة — جرّب إزالة الفلاتر'
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-9">
                  {products.map((product, i) => (
                    <div key={product.id} className={`animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>

                {/* ترقيم الصفحات */}
                {totalPages > 1 && (
                  <nav className="flex items-center justify-center gap-2 mt-14" aria-label="ترقيم الصفحات">
                    <button
                      disabled={page <= 1}
                      onClick={() => updateParams({ page: String(page - 1) })}
                      className="p-2.5 rounded-lg border border-stone-200 bg-white hover:border-brand-500 hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      aria-label="الصفحة السابقة"
                    >
                      <ChevronRight size={17} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .map((p, idx, arr) => (
                        <span key={p} className="flex items-center gap-2">
                          {idx > 0 && p - arr[idx - 1] > 1 && (
                            <span className="text-stone-400 px-1">…</span>
                          )}
                          <button
                            onClick={() => updateParams({ page: String(p) })}
                            className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all ${
                              p === page
                                ? 'bg-ink-900 text-white'
                                : 'border border-stone-200 bg-white text-stone-600 hover:border-brand-500 hover:text-brand-700'
                            }`}
                            aria-current={p === page ? 'page' : undefined}
                          >
                            {p.toLocaleString('ar-SA')}
                          </button>
                        </span>
                      ))}
                    <button
                      disabled={page >= totalPages}
                      onClick={() => updateParams({ page: String(page + 1) })}
                      className="p-2.5 rounded-lg border border-stone-200 bg-white hover:border-brand-500 hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      aria-label="الصفحة التالية"
                    >
                      <ChevronLeft size={17} />
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
