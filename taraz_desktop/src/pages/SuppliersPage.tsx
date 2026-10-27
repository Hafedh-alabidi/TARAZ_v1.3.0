import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Search, Loader2, X, Truck } from 'lucide-react'
import { suppliersAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { toast } from '@/stores/toast'
import { PageLoader, EmptyState } from '@/components/ui'
import type { Supplier } from '@/api/types'

interface SupplierForm {
  name: string; email: string; phone: string;
  address: string; city: string; country: string;
}

const EMPTY_FORM: SupplierForm = {
  name: '', email: '', phone: '', address: '', city: '', country: 'اليمن',
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await suppliersAPI.list({
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setSuppliers(data)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({
      name: s.name, email: s.email, phone: s.phone,
      address: s.address, city: s.city, country: s.country,
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('الاسم ورقم الهاتف مطلوبان')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await suppliersAPI.update(editing.id, form)
        toast.success('تم تحديث المورد')
      } else {
        await suppliersAPI.create(form)
        toast.success('تمت إضافة المورد')
      }
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`حذف المورد "${s.name}"؟`)) return
    try {
      await suppliersAPI.remove(s.id)
      toast.success('تم حذف المورد')
      load()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const inputCls = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-600 text-sm'

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">الموردون</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus size={18} /> مورد جديد
        </button>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالمورد أو المدينة أو البريد..."
          className="w-full px-10 py-2.5 border rounded-lg focus:outline-none focus:border-blue-600"
        />
      </div>

      {loading ? (
        <PageLoader label="جارٍ تحميل الموردين..." />
      ) : suppliers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm">
          <EmptyState title="لا يوجد موردون" subtitle="أضف أول مورد للبدء" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Truck size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{supplier.name}</h3>
                    <p className="text-xs text-gray-500">{supplier.city}، {supplier.country}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(supplier)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="تعديل">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(supplier)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="حذف">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="text-gray-400">الهاتف:</span> <span dir="ltr">{supplier.phone}</span></p>
                {supplier.email && <p className="truncate"><span className="text-gray-400">البريد:</span> <span dir="ltr">{supplier.email}</span></p>}
                {typeof supplier.products_count === 'number' && (
                  <p><span className="text-gray-400">المنتجات:</span> {supplier.products_count}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* النافذة */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">{editing ? `تعديل: ${editing.name}` : 'مورد جديد'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المورد *</label>
                <input type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الهاتف *</label>
                  <input type="tel" value={form.phone} dir="ltr"
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                  <input type="email" value={form.email} dir="ltr"
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المدينة</label>
                  <input type="text" value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الدولة</label>
                  <input type="text" value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                <textarea value={form.address} rows={2}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
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
