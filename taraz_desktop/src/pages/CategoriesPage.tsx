import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, X, Tags } from 'lucide-react'
import { categoriesAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { toast } from '@/stores/toast'
import { PageLoader, EmptyState } from '@/components/ui'
import type { Category } from '@/api/types'

interface CategoryForm {
  name: string
  description: string
  icon: string
}

const EMPTY_FORM: CategoryForm = { name: '', description: '', icon: '' }

const ICON_OPTIONS = [
  { value: 'electronics', label: 'إلكترونيات' },
  { value: 'fashion', label: 'ملابس' },
  { value: 'food', label: 'أطعمة' },
  { value: 'home', label: 'منزل' },
  { value: 'sports', label: 'رياضة' },
]

const ICON_EMOJI: Record<string, string> = {
  electronics: '📱', fashion: '👕', food: '☕', home: '🏠', sports: '🏋️',
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await categoriesAPI.list())
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (c: Category) => {
    setEditing(c)
    setForm({ name: c.name, description: c.description, icon: c.icon })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('اسم الفئة مطلوب')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await categoriesAPI.update(editing.id, form)
        toast.success('تم تحديث الفئة')
      } else {
        await categoriesAPI.create(form)
        toast.success('تمت إضافة الفئة')
      }
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: Category) => {
    if (typeof c.products_count === 'number' && c.products_count > 0) {
      toast.error(`لا يمكن حذف فئة تحتوي ${c.products_count} منتجات — انقل المنتجات أولاً`)
      return
    }
    if (!confirm(`حذف الفئة "${c.name}"؟`)) return
    try {
      await categoriesAPI.remove(c.id)
      toast.success('تم حذف الفئة')
      load()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const inputCls = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-600 text-sm'

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">فئات المنتجات</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus size={18} /> فئة جديدة
        </button>
      </div>

      {loading ? (
        <PageLoader label="جارٍ تحميل الفئات..." />
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm">
          <EmptyState title="لا توجد فئات" subtitle="أنشئ أول فئة لتصنيف المنتجات" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">
                    {ICON_EMOJI[cat.icon] ?? '🏷️'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{cat.name}</h3>
                    {typeof cat.products_count === 'number' && (
                      <p className="text-xs text-gray-500">{cat.products_count} منتجاً</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(cat)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="تعديل">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(cat)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="حذف">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {cat.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{cat.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Tags size={20} className="text-purple-600" />
                {editing ? `تعديل: ${editing.name}` : 'فئة جديدة'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفئة *</label>
                <input type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الأيقونة</label>
                <select value={form.icon}
                  onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className={inputCls}>
                  <option value="">بدون أيقونة</option>
                  {ICON_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{ICON_EMOJI[o.value]} {o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea value={form.description} rows={3}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={`${inputCls} resize-none`} />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 font-medium">
                  إلغاء
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
