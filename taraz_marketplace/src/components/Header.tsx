import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  ShoppingCart, Search, LogOut, Package, LayoutDashboard, ChevronDown,
  Menu, X, UserRound, Sparkles,
} from 'lucide-react'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/stores/toast'
import { authAPI } from '@/api/endpoints'
import { LogoFull } from '@/components/Logo'

export default function Header() {
  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const menuRef = useRef<HTMLDivElement>(null)

  const items = useCartStore(s => s.items)
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const { user, isAuthenticated, logout } = useAuthStore()

  // ظل خفيف عند التمرير
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // إغلاق قائمة المستخدم عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    navigate(q ? `/products?search=${encodeURIComponent(q)}` : '/products')
    setMobileMenuOpen(false)
  }

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch {
      // التوكن قد يكون منتهياً — نكمل تسجيل الخروج محلياً
    }
    logout()
    setUserMenuOpen(false)
    toast.info('تم تسجيل الخروج')
    navigate('/')
  }

  const navLinkClass = (path: string) =>
    `relative py-2 text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'text-ink-900'
        : 'text-stone-500 hover:text-ink-900'
    }`
  const navActive = (path: string) =>
    location.pathname === path ? (
      <span className="absolute -bottom-0.5 right-0 left-0 h-px bg-gold-500" />
    ) : null

  return (
    <header className="sticky top-0 z-50">
      {/* شريط إعلاني علوي — رسالة واحدة قصيرة */}
      <div className="bg-ink-950 text-stone-300 text-[12px]">
        <div className="container-luxe flex items-center justify-center py-2">
          <span className="flex items-center gap-2 whitespace-nowrap">
            شحن مجاني للطلبات فوق
            <b className="text-gold-300 font-semibold">٥٠٠ ر.س</b>
          </span>
        </div>
      </div>

      {/* الشريط الرئيسي — أبيض نظيف بحد شعري */}
      <div
        className={`border-b transition-all duration-300 bg-white ${
          scrolled ? 'border-stone-200/90 shadow-soft' : 'border-stone-200/60'
        }`}
      >
        <div className="container-luxe py-3.5 flex items-center justify-between gap-6">
          {/* الشعار */}
          <Link to="/" className="shrink-0 hover:opacity-85 transition-opacity" aria-label="طراز — الرئيسية">
            <LogoFull size={38} />
          </Link>

          {/* البحث — نظيف بلا زر ملون */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full group">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث عن منتج، فئة، أو ماركة…"
                className="input-luxe !rounded-full !py-2.5 pr-11 pl-4 !bg-stone-50/80 hover:!bg-white !border-stone-200/80 focus:!bg-white"
                aria-label="البحث عن منتج"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-full text-stone-400 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                aria-label="بحث"
              >
                <Search size={17} />
              </button>
            </div>
          </form>

          {/* التنقل */}
          <nav className="hidden lg:flex items-center gap-8" aria-label="التنقل الرئيسي">
            <Link to="/" className={navLinkClass('/')}>
              الرئيسية
              {navActive('/')}
            </Link>
            <Link to="/products" className={navLinkClass('/products')}>
              المنتجات
              {navActive('/products')}
            </Link>
            <Link to="/products?on_sale=1" className={`${navLinkClass('/offers')} inline-flex items-center gap-1.5`}>
              <Sparkles size={14} className="text-gold-600" />
              العروض
              {navActive('/offers')}
            </Link>
            <Link to="/orders" className={navLinkClass('/orders')}>
              طلباتي
              {navActive('/orders')}
            </Link>
          </nav>

          {/* الأدوات */}
          <div className="flex items-center gap-1.5">
            {/* السلة */}
            <Link
              to="/cart"
              className="relative p-2.5 rounded-xl text-stone-700 hover:text-ink-900 hover:bg-stone-100 transition-all"
              aria-label={`سلة التسوق${totalItems ? ` (${totalItems} عنصر)` : ''}`}
            >
              <ShoppingCart size={21} strokeWidth={1.8} />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -left-0.5 bg-gold-500 text-ink-950 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center border-2 border-white">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>

            {/* المستخدم */}
            {isAuthenticated && user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl hover:bg-stone-100 transition-all"
                  aria-label="قائمة الحساب"
                  aria-expanded={userMenuOpen}
                >
                  <div className="w-9 h-9 rounded-full bg-ink-900 text-white flex items-center justify-center font-semibold font-display text-sm">
                    {(user.first_name || user.username).charAt(0)}
                  </div>
                  <span className="hidden sm:flex flex-col items-start leading-none">
                    <span className="text-[13px] font-semibold text-stone-800">
                      {user.first_name || user.username}
                    </span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-stone-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {userMenuOpen && (
                  <div className="absolute left-0 mt-3 w-60 bg-white rounded-xl shadow-float border border-stone-200/80 py-2 animate-scale-in origin-top-left overflow-hidden">
                    <div className="px-5 py-3.5 bg-stone-50/70 border-b border-stone-100">
                      <p className="font-semibold text-stone-800 text-sm font-display">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-stone-400 truncate mt-0.5" dir="ltr">
                        {user.email}
                      </p>
                    </div>
                    <div className="p-1.5">
                      <Link
                        to="/orders"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-stone-700 hover:bg-stone-100 hover:text-ink-900 text-sm font-medium transition"
                      >
                        <Package size={17} className="text-stone-400" />
                        طلباتي
                      </Link>
                      {/* رابط لوحة الإدارة للموظفين */}
                      {['admin', 'manager', 'employee'].includes(user.role) && (
                        <a
                          href={import.meta.env.VITE_DESKTOP_URL ?? 'http://localhost:3000'}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-stone-700 hover:bg-stone-100 hover:text-ink-900 text-sm font-medium transition"
                        >
                          <LayoutDashboard size={17} className="text-stone-400" />
                          لوحة الإدارة
                          <span className="mr-auto text-[10px] bg-gold-100 text-gold-700 px-1.5 py-0.5 rounded-full font-semibold">
                            POS
                          </span>
                        </a>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium transition"
                      >
                        <LogOut size={17} />
                        تسجيل الخروج
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 text-stone-700 hover:text-ink-900 font-medium text-sm hover:bg-stone-100 rounded-lg transition"
                >
                  <UserRound size={16} />
                  دخول
                </Link>
                <Link to="/register" className="btn-primary btn-sm hidden sm:inline-flex">
                  حساب جديد
                </Link>
              </div>
            )}

            {/* قائمة الجوال */}
            <button
              className="lg:hidden p-2.5 rounded-xl hover:bg-stone-100 transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="القائمة"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* قائمة الجوال المنسدلة — أهداف لمس مريحة 48px+ */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white/98 backdrop-blur-md border-b border-stone-200 shadow-luxe animate-slide-down max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="container-luxe py-5 space-y-5">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن منتج…"
                  className="input-luxe !rounded-full pr-11"
                  aria-label="البحث عن منتج"
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              </div>
            </form>
            <nav className="grid gap-1" aria-label="تنقل الجوال">
              {[
                { to: '/', label: 'الرئيسية' },
                { to: '/products', label: 'كل المنتجات' },
                { to: '/products?on_sale=1', label: 'العروض والتخفيضات', gold: true },
                { to: '/orders', label: 'طلباتي' },
              ].map(l => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl font-medium text-[15px] transition ${
                    l.gold
                      ? 'text-gold-700 bg-gold-50/70 hover:bg-gold-100'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-ink-900'
                  }`}
                >
                  {l.label}
                  <span className="text-stone-300 text-xs">←</span>
                </Link>
              ))}
            </nav>
            {!isAuthenticated && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-outline text-center !py-3"
                >
                  دخول
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-primary text-center !py-3"
                >
                  حساب جديد
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
