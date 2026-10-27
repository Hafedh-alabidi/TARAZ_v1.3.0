import { useEffect, useState, useCallback, useRef } from 'react'
import { AlertCircle, Plus, Search, Pencil, Trash2, PackagePlus, Loader2, X, History, ImagePlus } from 'lucide-react'
import { productsAPI, categoriesAPI, suppliersAPI, stockMovementsAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { useAuthStore, isAdminOrManager } from '@/stores/auth'
import { toast } from '@/stores/toast'
import { PageLoader, EmptyState } from '@/components/ui'
import type { Product, Category, Supplier, StockMovement } from '@/api/types'

interface ProductForm {
  name: string
  description: string
  category: number | ''
  supplier: number | ''
  price: string
  cost: string
  quantity: string
  min_quantity: string
  sku: string
  barcode: string
  image: string
  is_active: boolean
}

const EMPTY_FORM: ProductForm = {
  name: '', description: '', category: '', supplier: '',
  price: '', cost: '', quantity: '0', min_quantity: '10',
  sku: '', barcode: '', image: '', is_active: true,
}

export default function InventoryPage() {
  const user = useAuthStore(s => s.user)
  const canManage = isAdminOrManager(user)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [restockTarget, setRestockTarget] = useState<Product | null>(null)
  const [restockAmount, setRestockAmount] = useState('')
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<Product | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, cats, sups] = await Promise.all([
        productsAPI.all({ ordering: 'name' }),
        categoriesAPI.list(),
        suppliersAPI.list().catch(() => [] as Supplier[]),
      ])
      setProducts(prods)
      setCategories(cats)
      setSuppliers(sups)
      // سجل حركات المخزون (تدقيق) — يفشل بصمت للموظف غير المصرح
      stockMovementsAPI.list({ page_size: 8 })
        .then(d => setMovements(d.results ?? []))
        .catch(() => {})
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ✅ P1: رفع صورة منتج مباشرة من صف الجدول
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const product = uploadTargetRef.current
    e.target.value = '' // السماح بإعادة اختيار نفس الملف
    if (!file || !product) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن يكون أقل من 5 ميغابايت')
      return
    }
    setUploadingId(product.id)
    try {
      const res = await productsAPI.uploadImage(product.id, file)
      toast.success(`تم رفع صورة «${product.name}» بنجاح`)
      // تحديث الصورة في القائمة المحلية فوراً
      setProducts(prev => prev.map(p => p.id === product.id
        ? { ...p, image_url: res.image_url, image: res.image_url } : p))
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setUploadingId(null)
      uploadTargetRef.current = null
    }
  }

  const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= p.min_quantity)
  const outOfStock = products.filter(p => p.quantity <= 0)

  const display = (() => {
    const q = search.trim().toLowerCase()
    let list = filter === 'low' ? lowStock : filter === 'out' ? outOfStock : products
    if (q) list = list.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q))
    return list
  })()

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description,
      category: p.category,
      supplier: p.supplier ?? '',
      price: p.price,
      cost: p.cost,
      quantity: String(p.quantity),
      min_quantity: String(p.min_quantity),
      sku: p.sku,
      barcode: p.barcode,
      image: p.image,
      is_active: p.is_active,
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.category || !form.price || !form.sku.trim()) {
      toast.error('يرجى إكمال الحقول المطلوبة (الاسم، الفئة، السعر، SKU)')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        category: Number(form.category),
        supplier: form.supplier === '' ? null : Number(form.supplier),
        price: parseFloat(form.price),
        cost: parseFloat(form.cost) || 0,
        quantity: parseInt(form.quantity, 10) || 0,
        min_quantity: parseInt(form.min_quantity, 10) || 0,
        sku: form.sku.trim(),
        barcode: form.barcode,
        image: form.image,
        is_active: form.is_active,
      }
      if (editing) {
        await productsAPI.update(editing.id, payload)
        toast.success('تم تحديث المنتج بنجاح')
      } else {
        await productsAPI.create(payload)
        toast.success('تمت إضافة المنتج بنجاح')
      }
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: Product) => {
    if (!confirm(`حذف "${p.name}"؟\nملاحظة: المنتجات المرتبطة بطلبات تُعطّل بدلاً من حذفها.`)) return
    try {
      await productsAPI.remove(p.id)
      toast.success('تمت العملية بنجاح')
      load()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restockTarget) return
    const amount = parseInt(restockAmount, 10)
    if (!amount || amount <= 0) {
      toast.error('أدخل كمية صحيحة')
      return
    }
    try {
      await productsAPI.restock(restockTarget.id, amount)
      toast.success(`تمت إضافة ${amount} قطعة إلى ${restockTarget.name}`)
      setRestockTarget(null)
      setRestockAmount('')
      load()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const inputCls = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-600 text-sm'

  return (
    <div className="p-4 md:p-8">
      {/* مدخل رفع الصور المخفي — يُفتح من زر الصورة في صف الجدول */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">إدارة المخزون</h1>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Plus size={18} />
            منتج جديد
          </button>
        )}
      </div>

      {/* التنبيهات */}
      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="space-y-3 mb-6">
          {outOfStock.length > 0 && (
            <div className="bg-red-50 border-r-4 border-red-500 p-4 rounded-r-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-600" size={22} />
                <p className="text-red-800">
                  <span className="font-bold">{outOfStock.length}</span> منتجات نفدت من المخزون
                </p>
              </div>
              <button onClick={() => setFilter('out')} className="text-red-700 font-medium text-sm hover:underline">
                عرضها
              </button>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="bg-amber-50 border-r-4 border-amber-400 p-4 rounded-r-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-amber-600" size={22} />
                <p className="text-amber-800">
                  <span className="font-bold">{lowStock.length}</span> منتجات وصلت للحد الأدنى
                </p>
              </div>
              <button onClick={() => setFilter('low')} className="text-amber-700 font-medium text-sm hover:underline">
                عرضها
              </button>
            </div>
          )}
        </div>
      )}

      {/* أدوات الفلترة */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-52 max-w-md">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم / SKU / الباركود..."
            className="w-full px-10 py-2.5 border rounded-lg focus:outline-none focus:border-blue-600"
          />
        </div>
        <div className="flex gap-2">
          {([
            { v: 'all', l: `الكل (${products.length})` },
            { v: 'low', l: `منخفض (${lowStock.length})` },
            { v: 'out', l: `نفد (${outOfStock.length})` },
          ] as const).map(f => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === f.v ? 'bg-blue-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* الجدول */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader label="جارٍ تحميل المخزون..." />
        ) : display.length === 0 ? (
          <EmptyState title="لا توجد منتجات" subtitle="أضف أول منتج للبدء" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold">المنتج</th>
                  <th className="px-4 py-3 text-right font-semibold">SKU</th>
                  <th className="px-4 py-3 text-right font-semibold">الفئة</th>
                  <th className="px-4 py-3 text-right font-semibold">الكمية</th>
                  <th className="px-4 py-3 text-right font-semibold">الحد الأدنى</th>
                  <th className="px-4 py-3 text-right font-semibold">السعر</th>
                  <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {display.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-400">{product.supplier_name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">{product.sku}</td>
                    <td className="px-4 py-3 text-gray-600">{product.category_name}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${
                        product.quantity <= 0 ? 'text-red-600' :
                        product.quantity <= product.min_quantity ? 'text-amber-600' : 'text-gray-800'
                      }`}>
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{product.min_quantity}</td>
                    <td className="px-4 py-3 font-bold text-blue-600">
                      {parseFloat(product.price).toLocaleString('ar-SA')} ر.س
                    </td>
                    <td className="px-4 py-3">
                      {product.quantity <= 0 ? (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">نفد</span>
                      ) : product.quantity <= product.min_quantity ? (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">منخفض</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">جيد</span>
                      )}
                      {!product.is_active && (
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium mr-1">معطل</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setRestockTarget(product); setRestockAmount('') }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="إعادة تخزين"
                        >
                          <PackagePlus size={16} />
                        </button>
                        {canManage && (
                          <button
                            onClick={() => {
                              uploadTargetRef.current = product
                              fileInputRef.current?.click()
                            }}
                            disabled={uploadingId === product.id}
                            className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg disabled:opacity-40"
                            title="رفع صورة المنتج"
                          >
                            {uploadingId === product.id
                              ? <Loader2 size={16} className="animate-spin" />
                              : <ImagePlus size={16} />}
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button
                              onClick={() => openEdit(product)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="تعديل"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(product)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="حذف"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* آخر حركات المخزون — سجل التدقيق */}
        {movements.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
              <History size={20} className="text-blue-600" /> آخر حركات المخزون
            </h2>
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-3 text-right font-medium">الوقت</th>
                    <th className="p-3 text-right font-medium">المنتج</th>
                    <th className="p-3 text-right font-medium">الحركة</th>
                    <th className="p-3 text-right font-medium">الكمية</th>
                    <th className="p-3 text-right font-medium">الرصيد بعد</th>
                    <th className="p-3 text-right font-medium">المرجع</th>
                    <th className="p-3 text-right font-medium">بواسطة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500 whitespace-nowrap">{new Date(m.created_at).toLocaleString('ar-SA', { hour12: false })}</td>
                      <td className="p-3 font-medium text-gray-800">{m.product_name}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.movement_type === 'out' ? 'bg-red-50 text-red-700' :
                          m.movement_type === 'return' ? 'bg-amber-50 text-amber-700' :
                          m.movement_type === 'in' ? 'bg-green-50 text-green-700' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          {m.movement_type_display}
                        </span>
                      </td>
                      <td className={`p-3 font-semibold ${m.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </td>
                      <td className="p-3 text-gray-700">{m.stock_after}</td>
                      <td className="p-3 text-gray-500">{m.reference || '—'}</td>
                      <td className="p-3 text-gray-500">{m.created_by_name ?? 'النظام'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* نافذة إضافة/تعديل */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editing ? `تعديل: ${editing.name}` : 'منتج جديد'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفئة *</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className={inputCls} required>
                  <option value="">اختر الفئة...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المورد</label>
                <select value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className={inputCls}>
                  <option value="">بدون مورد</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع *</label>
                <input type="number" min="0" step="0.01" value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={inputCls} required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة</label>
                <input type="number" min="0" step="0.01" value={form.cost}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية</label>
                <input type="number" min="0" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى</label>
                <input type="number" min="0" value={form.min_quantity}
                  onChange={e => setForm(f => ({ ...f, min_quantity: e.target.value }))} className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                <input type="text" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  className={inputCls} required dir="ltr" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الباركود</label>
                <input type="text" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                  className={inputCls} dir="ltr" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة</label>
                <input type="url" value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                  className={inputCls} placeholder="https://..." dir="ltr" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea value={form.description} rows={3}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={`${inputCls} resize-none`} />
              </div>

              <label className="sm:col-span-2 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="accent-blue-600 w-4 h-4" />
                <span className="text-sm text-gray-700">المنتج نشط ومعروض في المتجر</span>
              </label>

              <div className="sm:col-span-2 flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 transition font-medium">
                  إلغاء
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> جارٍ الحفظ...</> : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة إعادة التخزين */}
      {restockTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setRestockTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-2">إعادة تخزين</h3>
            <p className="text-sm text-gray-600 mb-1">{restockTarget.name}</p>
            <p className="text-xs text-gray-400 mb-4">الكمية الحالية: {restockTarget.quantity}</p>
            <form onSubmit={handleRestock}>
              <label className="block text-sm font-medium text-gray-700 mb-1">الكمية المضافة</label>
              <input type="number" min="1" value={restockAmount} autoFocus
                onChange={e => setRestockAmount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-600 mb-4" />
              <div className="flex gap-3">
                <button type="button" onClick={() => setRestockTarget(null)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 font-medium">
                  إلغاء
                </button>
                <button type="submit"
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 font-bold">
                  إضافة للمخزون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
