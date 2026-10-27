import { useEffect, useState, useCallback } from 'react'
import { Search, UserCheck, UserX, Plus, Loader2, X } from 'lucide-react'
import { usersAPI } from '@/api/endpoints'
import { extractErrorMessage } from '@/api/client'
import { toast } from '@/stores/toast'
import { PageLoader, EmptyState } from '@/components/ui'
import type { User, Role } from '@/api/types'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'مشرف النظام', manager: 'مدير المحل', employee: 'موظف', customer: 'عميل',
}

interface UserForm {
  username: string
  email: string
  first_name: string
  last_name: string
  phone: string
  role: Role
  password: string
}

const EMPTY_FORM: UserForm = {
  username: '', email: '', first_name: '', last_name: '', phone: '', role: 'customer', password: '',
}

export default function CustomersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await usersAPI.list({
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setUsers(data.results)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [roleFilter, search])

  useEffect(() => {
    const t = setTimeout(load, 300) // debounce للبحث
    return () => clearTimeout(t)
  }, [load])

  const toggleActive = async (user: User) => {
    try {
      await usersAPI.toggleActive(user.id, !user.is_active)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      toast.success(user.is_active ? `تم تعطيل ${user.username}` : `تم تنشيط ${user.username}`)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username.trim() || !form.email.trim() || form.password.length < 8) {
      toast.error('اسم المستخدم والبريد مطلوبان، وكلمة المرور 8 أحرف على الأقل')
      return
    }
    setSaving(true)
    try {
      await usersAPI.create({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        password2: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        role: form.role,
      })
      toast.success('تم إنشاء المستخدم بنجاح')
      setShowModal(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-600 text-sm'

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">المستخدمون والعملاء</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus size={18} /> مستخدم جديد
        </button>
      </div>

      {/* الفلاتر */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-52 max-w-md">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد أو الهاتف..."
            className="w-full px-10 py-2.5 border rounded-lg focus:outline-none focus:border-blue-600"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as Role | '')}
          className="border rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-600"
        >
          <option value="">كل الأدوار</option>
          <option value="customer">العملاء</option>
          <option value="employee">الموظفون</option>
          <option value="manager">المديرون</option>
          <option value="admin">المشرفون</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader label="جارٍ تحميل المستخدمين..." />
        ) : users.length === 0 ? (
          <EmptyState title="لا يوجد مستخدمون" subtitle="أنشئ أول مستخدم" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold">المستخدم</th>
                  <th className="px-4 py-3 text-right font-semibold">الدور</th>
                  <th className="px-4 py-3 text-right font-semibold">الهاتف</th>
                  <th className="px-4 py-3 text-right font-semibold">المدينة</th>
                  <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-right font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                          {(user.first_name || user.username).charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{user.first_name} {user.last_name}</p>
                          <p className="text-xs text-gray-500">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">{user.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{user.city || '—'}</td>
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">نشط</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">معطل</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(user)}
                        className={`p-2 rounded-lg transition ${
                          user.is_active
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={user.is_active ? 'تعطيل' : 'تنشيط'}
                      >
                        {user.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة إنشاء مستخدم */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">مستخدم جديد</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الأول</label>
                  <input type="text" value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم العائلة</label>
                  <input type="text" value={form.last_name}
                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم *</label>
                <input type="text" value={form.username} dir="ltr"
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className={inputCls} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني *</label>
                <input type="email" value={form.email} dir="ltr"
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الهاتف</label>
                  <input type="tel" value={form.phone} dir="ltr"
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                  <select value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} className={inputCls}>
                    <option value="customer">عميل</option>
                    <option value="employee">موظف</option>
                    <option value="manager">مدير المحل</option>
                    <option value="admin">مشرف النظام</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور * (8+ أحرف)</label>
                <input type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputCls} required minLength={8} />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 font-medium">
                  إلغاء
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'إنشاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
