/**
 * شعار طراز — قمة ذهبية فوق مستويين على درع زمردي.
 * علامة "الطراز": الذروة والقمة، تصلح مصغرة (favicon) وكبيرة.
 */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="شعار طراز"
    >
      <defs>
        <linearGradient id="taraz-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#047857" />
          <stop offset="1" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id="taraz-peak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3de8f" />
          <stop offset="1" stopColor="#c9a227" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#taraz-bg)" />
      <path d="M32 13 L47 36 L36.5 36 L32 28.5 L27.5 36 L17 36 Z" fill="url(#taraz-peak)" />
      <rect x="15" y="41" width="34" height="4.5" rx="2.25" fill="#ffffff" />
      <rect x="15" y="49" width="23" height="4.5" rx="2.25" fill="#ffffff" opacity="0.5" />
    </svg>
  )
}

/** الشعار الكامل: العلامة + اسم المتجر + الشعار النصي */
export function LogoFull({
  size = 42,
  light = false,
  className = '',
}: {
  size?: number
  light?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display font-black text-2xl tracking-tight ${
            light ? 'text-white' : 'text-brand-900'
          }`}
        >
          طراز
        </span>
        <span
          className={`text-[10px] font-medium mt-1 tracking-wide ${
            light ? 'text-gold-200/80' : 'text-gold-600'
          }`}
        >
          TARAZ · تسوّق بذوقٍ يليق بك
        </span>
      </span>
    </span>
  )
}
