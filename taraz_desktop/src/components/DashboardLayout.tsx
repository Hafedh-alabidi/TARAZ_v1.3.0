import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, ShoppingCart, Package, FileText, Users, Truck, Tags, Receipt, LogOut } from 'lucide-react'
import { useAuthStore, isAdminOrManager } from '@/stores/auth'
import { authAPI } from '@/api/endpoints'
import { toast } from '@/stores/toast'
import ToastContainer from '@/components/ToastContainer'
import { LogoMark } from '@/components/Logo'

const NAV_ITEMS = [
  { to: '/', label: 'لوحة التحكم', icon: BarChart3, end: true },
  { to: '/pos', label: 'نقطة البيع', icon: ShoppingCart },
  { to: '/orders', label: 'الطلبات', icon: Receipt },
  { to: '/inventory', label: 'المخزون', icon: Package },
  { to: '/categories', label: 'الفئات', icon: Tags, adminOnly: true },
  { to: '/suppliers', label: 'الموردون', icon: Truck, adminOnly: true },
  { to: '/customers', label: 'العملاء', icon: Users, adminOnly: true },
  { to: '/reports', label: 'التقارير', icon: FileText },
]

export default function DashboardLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch {
      // التوكن قد يكون منتهياً
    }
    logout()
    toast.info('تم تسجيل الخروج بنجاح')
    navigate('/login', { replace: true })
  }

  const canSee = (item: typeof NAV_ITEMS[number]) =>
    !item.adminOnly || isAdminOrManager(user)

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">
      {/* الشريط الجانبي الداكن الفاخر */}
      <aside className="relative w-64 bg-gradient-to-b from-ink-950 via-brand-950 to-ink-950 flex flex-col shrink-0 overflow-hidden">
        <div className="absolute inset-0 pattern-diamond pointer-events-none" />
        <div className="glow-gold w-64 h-64 -top-16 -right-16 opacity-60" />

        {/* العلامة */}
        <div className="relative p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <LogoMark size={44} />
            <div className="leading-none">
              <h1 className="text-xl font-black font-display text-white">طراز</h1>
              <p className="text-[10px] text-gold-200/70 mt-1.5 tracking-wide">نظام إدارة المبيعات · POS</p>
            </div>
          </div>
        </div>

        {/* التنقل */}
        <nav className="relative p-4 space-y-1.5 flex-1 overflow-y-auto">
          {NAV_ITEMS.filter(canSee).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3.5 p-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-l from-brand-600 to-brand-700 text-white shadow-luxe'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.07]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-l-full bg-gradient-to-b from-gold-300 to-gold-500" />
                  )}
                  <item.icon size={19} className={isActive ? 'text-gold-200' : ''} />
                  <span className="font-bold text-sm">{item.label}</span>
                  {item.adminOnly && (
                    <span className="mr-auto text-[9px] font-black bg-gold-500/15 text-gold-300 border border-gold-400/20 px-1.5 py-0.5 rounded-full">
                      إدارة
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* المستخدم */}
        <div className="relative border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white flex items-center justify-center font-black font-display shadow-soft ring-2 ring-white/10">
              {(user?.first_name || user?.username || '?').charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[11px] text-gold-200/70 font-medium">{user?.role_display}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-2.5 bg-red-500/10 text-red-300 border border-red-400/20 rounded-xl hover:bg-red-500/20 transition font-bold text-sm"
          >
            <LogOut size={17} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* المحتوى */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>

      <ToastContainer />
    </div>
  )
}
