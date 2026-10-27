import { Link, useLocation } from 'react-router-dom'
import { Home, LayoutGrid, ShoppingCart, UserRound } from 'lucide-react'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'

/**
 * شريط تنقل سفلي للجوال — وصول بإصبع واحد للوجهات الأربع الأهم.
 * يظهر فقط على الشاشات الصغيرة (md وأقل)، مع احترام مساحة الأمان.
 */
export default function MobileBottomNav() {
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  const links = [
    { to: '/', label: 'الرئيسية', icon: Home },
    { to: '/products', label: 'المنتجات', icon: LayoutGrid },
    { to: '/cart', label: 'السلة', icon: ShoppingCart, badge: totalItems },
    {
      to: isAuthenticated ? '/orders' : '/login',
      label: isAuthenticated ? 'طلباتي' : 'دخول',
      icon: UserRound,
    },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/97 backdrop-blur-md border-t border-stone-200/90"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="التنقل السفلي للجوال"
    >
      <div className="grid grid-cols-4">
        {links.map(l => {
          const active =
            l.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(l.to) && l.to !== '/'
          return (
            <Link
              key={l.label}
              to={l.to}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] transition-colors ${
                active ? 'text-brand-700' : 'text-stone-400 hover:text-stone-600'
              }`}
              aria-label={l.label}
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative">
                <l.icon size={21} strokeWidth={active ? 2.1 : 1.7} />
                {typeof l.badge === 'number' && l.badge > 0 && (
                  <span className="absolute -top-1.5 -left-2 bg-gold-500 text-ink-950 text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {l.badge > 99 ? '99+' : l.badge}
                  </span>
                )}
              </span>
              <span className={`text-[10.5px] ${active ? 'font-semibold' : 'font-medium'}`}>
                {l.label}
              </span>
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gold-500" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
