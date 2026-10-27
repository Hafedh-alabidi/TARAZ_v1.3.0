import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, ShieldCheck, HelpCircle, Phone, Mail, Clock, MapPin,
  ChevronDown, CreditCard, Truck, RefreshCcw, Lock,
} from 'lucide-react'
import { useConfigStore } from '@/stores/config'

/**
 * ✅ P0-5: صفحات قانونية حقيقية بروابط فعلية — بدل mailto وهمية.
 * المحتوى يُبنى ديناميكياً من إعدادات الخادم (الاسم التجاري، الرقم الضريبي،
 * بيانات التواصل) حتى تتطابق دائماً مع الواقع التشغيلي.
 */

/** بيانات التواصل الاحتياطية — تُستخدم فقط إن تعذّر تحميل إعدادات الخادم */
const SUPPORT_EMAIL = 'DigitalCreativityteam5@gmail.com'
const SUPPORT_PHONE = '00967 777279161'
/** تحويل رقم العرض إلى صيغة دولية صالحة للاتصال المباشر: 00967… → +967… */
const telHref = (phone?: string) =>
  `tel:${(phone ?? SUPPORT_PHONE).replace(/[^\d+]/g, '').replace(/^00/, '+')}`

// ============================================================
// مكوّن مساعد: غلاف صفحة المحتوى
// ============================================================
function LegalShell({ icon, title, subtitle, children }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div>
      {/* ترويسة الصفحة */}
      <div className="relative bg-gradient-to-bl from-ink-950 via-brand-950 to-ink-900 text-white overflow-hidden">
        <div className="absolute inset-0 pattern-diamond pointer-events-none" />
        <div className="glow-gold w-96 h-96 -top-28 -left-20 opacity-50" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-center gap-5">
            <span className="shrink-0 w-16 h-16 rounded-2xl bg-white/[0.07] border border-white/15 backdrop-blur-sm flex items-center justify-center text-gold-300">
              {icon}
            </span>
            <div>
              <h1 className="font-display font-black text-3xl sm:text-4xl">{title}</h1>
              <p className="text-white/60 text-sm mt-2">{subtitle}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="card !rounded-3xl p-8 sm:p-10">
          <div className="space-y-7 text-stone-600 leading-[1.95] text-[15px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-3">
        <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-gold-300 to-gold-500 shrink-0" />
        {title}
      </h2>
      <div className="space-y-3 pr-4">{children}</div>
    </section>
  )
}

// ============================================================
// الشروط والأحكام
// ============================================================
export function TermsPage() {
  const config = useConfigStore(s => s.config)
  const storeName = config?.store_name ?? 'متجر طراز'
  return (
    <LegalShell icon={<FileText size={26} />} title="الشروط والأحكام"
      subtitle="آخر تحديث: أكتوبر 2026 — يُطبق على كل استخدام للمتجر والطلب منه">
      <p>
        مرحباً بك في {storeName}. باستخدامك هذا المتجر أو إنشائك حساباً أو إتمامك طلب شراء،
        فأنت توافق على الشروط والأحكام الموضحة في هذه الصفحة. ننصحك بقراءتها كاملة قبل
        استخدام الخدمة، فهي تشكل اتفاقاً ملزماً بينك وبين المتجر فيما يتعلق بكل عملية شراء.
        إن لم توافق على أي بند من هذه الشروط فيرجى التوقف عن استخدام الموقع.
      </p>

      <Section title="1. الحساب والاستخدام">
        <p>
          يتحمل المستخدم مسؤولية الحفاظ على سرية بيانات دخوله (كلمة المرور) وكل النشاطات
          التي تجري من حسابه. يجب إخطارنا فوراً بأي استخدام غير مصرح به لحسابك. يحق للمتجر
          تعطيل أي حساب يُساء استخدامه أو يخالف هذه الشروط دون إشعار مسبق.
        </p>
      </Section>

      <Section title="2. الطلبات والأسعار">
        <p>
          جميع الأسعار المعروضة بالريال السعودي (SAR) وتشمل الضريبة العامة على المبيعات
          حيثما انطبقت. يتم تأكيد الطلب بعد استلامه وقبوله من قبلنا؛ نحتفظ بحق الاعتذار عن تنفيذ أي طلب
          في حال نفاد الكمية أو وجود خطأ واضح في سعر المنتج، مع إعادة أي مبلغ محصّل مسبقاً
          بنفس وسيلة الدفع خلال مدة لا تتجاوز 14 يوم عمل.
        </p>
      </Section>

      <Section title="3. الدفع">
        <p>
          نوفر الدفع الإلكتروني بالبطاقات (جيب، Visa، Mastercard) عبر بوابة دفع مرخصة،
          إضافة إلى الدفع عند الاستلام والتحويل البنكي. لا نخزن بيانات بطاقتك على أنظمتنا
          إطلاقاً — تُعالج العملية لدى مزود الدفع المعتمد.
        </p>
      </Section>

      <Section title="4. الشحن والتسليم">
        <p>
          تُشحن الطلبات المؤكدة داخل المدن الرئيسية في الجمهورية اليمنية خلال 1-3 أيام عمل، وقد تمتد المدة
          للمناطق البعيدة. يعتبر التسليم مكتملاً عند استلام الطلب من الناقل أو مندوب التسليم.
          الشحن مجاني للطلبات التي تبلغ قيمتها الحد المعلن في صفحة الدفع.
        </p>
      </Section>

      <Section title="5. الاسترجاع والاستبدال">
        <p>
          وفق قانون حماية المستهلك المعمول به في الجمهورية اليمنية، يمكنك طلب استرجاع أو استبدال المنتج خلال 7 أيام
          من الاستلام بشرط كونه بحالته الأصلية وبتغليفه السليم مع الفاتورة. تُستثنى من ذلك
          المنتجات المخصصة بطلبك بالاسم (المفصلة) والسلع سريعة التلف كالمواد الغذائية المفتوحة.
        </p>
      </Section>

      <Section title="6. الفاتورة الإلكترونية">
        <p>
          تصدر فواتيرنا كفواتير ضريبية إلكترونية مبسطة، وتتضمن رمز QR الذي يحمل اسم البائع
          ورقمه الضريبي وإجمالي الفاتورة وضريبتها وفق متطلبات مصلحة الضرائب اليمنية.
          يمكنك عرض الفاتورة وتحميلها من صفحة «طلباتي» في أي وقت.
        </p>
      </Section>

      <Section title="7. المسؤولية">
        <p>
          نلتزم بتقديم المنتجات كما هي موصوفة. لا يتحمل المتجر مسؤولية الأضرار غير المباشرة
          الناتجة عن سوء استخدام المنتج أو التأخير الناجم عن ظروف خارجة عن إرادتنا. حدود
          مسؤوليتنا في كل الأحوال لا تتجاوز قيمة الطلب موضوع النزاع.
        </p>
      </Section>

      <Section title="8. القانون الواجب التطبيق">
        <p>
          تخضع هذه الشروط لأنظمة الجمهورية اليمنية وقوانينها النافذة، وتختص المحاكم اليمنية بأي نزاع
          ينشأ عنها. لأي استفسار قانوني تواصل معنا عبر صفحة «اتصل بنا».
        </p>
      </Section>
    </LegalShell>
  )
}

// ============================================================
// سياسة الخصوصية
// ============================================================
export function PrivacyPage() {
  return (
    <LegalShell icon={<ShieldCheck size={26} />} title="سياسة الخصوصية"
      subtitle="كيف نجمع بياناتك ونستخدمها ونحميها">
      <p>
        نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية وفق الأنظمة والقوانين النافذة
        في الجمهورية اليمنية. توضح هذه السياسة أنواع البيانات التي نجمعها عند استخدامك متجرنا، والغرض
        من جمعها، وحقوقك تجاهها. استخدامك للمتجر بعد نشر أي تحديث لهذه السياسة يعني موافقتك
        على النسخة المحدثة.
      </p>

      <Section title="البيانات التي نجمعها">
        <p>
          نجمع الحد الأدنى اللازم لتشغيل الخدمة: بيانات الحساب (الاسم، البريد الإلكتروني،
          رقم الجوال)، وبيانات الطلبات (العناوين، المنتجات المشتراة، مبالغ الدفع)، وبيانات
          تقنية تشغيلية (سجلات الاستخدام والأخطاء لأغراض الأمان وتحسين الأداء).
        </p>
        <p className="flex items-start gap-2.5 bg-brand-50/80 border border-brand-100 rounded-xl p-4 text-sm">
          <Lock size={16} className="text-brand-600 mt-0.5 shrink-0" />
          <span>
            <b>بيانات الدفع لا تصلنا أبداً:</b> أرقام البطاقات تُدخل لدى بوابة الدفع المرخصة
            مباشرة — لا نخزنها ولا نراها على أنظمتنا.
          </span>
        </p>
      </Section>

      <Section title="كيف نستخدم بياناتك">
        <p>
          نستخدم بياناتك لتنفيذ طلباتك وشحنها، ولإصدار الفواتير الضريبية، ولإشعارك بحالة
          طلبك، ولتأمين الحساب (كإشعارات تغيير كلمة المرور)، ولتحسين تجربة التسوق.
          لا نبيع بياناتك لأي طرف ثالث إطلاقاً، ولا نشاركها إلا مع جهات التشغيل الضرورية
          (الشحن، الدفع) بالحد الذي تتطلبه الخدمة أو بموجب التزام نظامي على الجهات المختصة.
        </p>
      </Section>

      <Section title="مدة الاحتفاظ">
        <p>
          نحتفظ ببيانات الحساب ما دام حسابك نشطاً، وببيانات الفواتير والطلبات للمدد النظامية
          المطلوبة (ست سنوات للفواتير الضريبية). عند طلب حذف حسابك نزيل البيانات الشخصية
          غير الخاضعة لالتزام نظامي خلال 30 يوماً.
        </p>
      </Section>

      <Section title="حقوقك">
        <p>
          لك الحق في الوصول إلى بياناتك وتصحيحها، وسحب موافقتك على المعالجة، وطلب حذف
          حسابك (مع بقاء السجلات الضريبية بحكم النظام). لممارسة أي من هذه الحقوق تواصل
          معنا عبر <Link to="/contact" className="text-brand-600 hover:text-brand-800 hover:underline font-bold">صفحة اتصل بنا</Link>.
        </p>
      </Section>

      <Section title="ملفات تعريف الارتباط (Cookies)">
        <p>
          نستخدم ملفات تعريف أساسية لحفظ جلسة تسجيل دخلك ومحتويات سلتك — وهي ضرورية لعمل
          المتجر ولا تتبعك عبر المواقع الأخرى. يمكنك مسحها من متصفحك في أي وقت.
        </p>
      </Section>
    </LegalShell>
  )
}

// ============================================================
// الأسئلة الشائعة
// ============================================================
const FAQ_ITEMS = [
  {
    q: 'كم تستغرق مدة التوصيل؟',
    a: 'داخل المدن الرئيسية (صنعاء، عدن، تعز) خلال 1-3 أيام عمل من تأكيد الطلب. بقية المحافظات قد تستغرق حتى 5 أيام عمل. يمكنك متابعة حالة طلبك لحظة بلحظة من صفحة «طلباتي».',
  },
  {
    q: 'ما طرق الدفع المتاحة؟',
    a: 'الدفع الإلكتروني بالبطاقات (جيب، Visa، Mastercard) عبر بوابة دفع آمنة، إضافة إلى الدفع عند الاستلام والتحويل البنكي. الشحن مجاني عند تجاوز الحد المعلن في صفحة الدفع.',
  },
  {
    q: 'هل يمكنني إلغاء طلبي؟',
    a: 'نعم — يمكنك إلغاء الطلب بنفسك من صفحة «طلباتي» ما دام في حالة «قيد الانتظار». بعد التأكيد والشحن تواصل مع خدمة العملاء وسنساعدك وفق سياسة الاسترجاع.',
  },
  {
    q: 'كيف أسترجع منتجاً أو أستبدله؟',
    a: 'خلال 7 أيام من الاستلام بشرط سلامة المنتج وتغليفه الأصلي مع الفاتورة. افتح طلباً عبر صفحة «اتصل بنا» مع رقم الطلب وسيتولى فريقنا الترتيب مع شركة الشحن.',
  },
  {
    q: 'نسيت كلمة المرور — ماذا أفعل؟',
    a: 'من صفحة تسجيل الدخول اضغط «نسيت كلمة المرور؟» وأدخل بريدك المسجل، ستستلم رابطاً لإعادة التعيين صالحاً لمرة واحدة ولمدة 24 ساعة. إن لم تصلك الرسالة فتفقد مجلد البريد المزعج.',
  },
  {
    q: 'أين أجد فاتورتي الضريبية؟',
    a: 'من صفحة «طلباتي» افتح تفاصيل أي طلب واضغط «عرض الفاتورة» — تظهر الفاتورة الإلكترونية المبسطة مع رمز QR للتحقق الضريبي، ويمكنك طباعتها أو حفظها.',
  },
  {
    q: 'هل الأسعار تشمل الضريبة؟',
    a: 'الأسعار المعروضة للمنتجات قبل الضريبة، وتضاف الضريبة العامة على المبيعات (5%) ورسوم الشحن عند الدفع وتظهر بوضوح في ملخص الطلب قبل التأكيد. الأسعار بالريال السعودي (SAR).',
  },
]

export function FAQPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  return (
    <LegalShell icon={<HelpCircle size={26} />} title="الأسئلة الشائعة"
      subtitle="إجابات سريعة عن أكثر ما يسأل عنه عملاؤنا">
      <div className="space-y-3">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className={`border rounded-2xl overflow-hidden transition-all ${
            openIdx === i ? 'border-brand-300 shadow-soft bg-brand-50/30' : 'border-stone-200 bg-white hover:border-stone-300'
          }`}>
            <button
              className="w-full flex items-center justify-between gap-3 p-4 text-right transition"
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              aria-expanded={openIdx === i}
            >
              <span className="font-bold text-stone-800 text-[15px] flex items-center gap-3">
                <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 transition-colors ${
                  openIdx === i ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white' : 'bg-stone-100 text-stone-400'
                }`}>
                  {i + 1}
                </span>
                {item.q}
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 transition-transform duration-300 ${
                  openIdx === i ? 'rotate-180 text-brand-600' : 'text-stone-400'
                }`}
              />
            </button>
            {openIdx === i && (
              <div className="px-4 pb-4 pr-14 text-sm text-stone-600 leading-[1.9] animate-fade-in">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-stone-500 pt-3">
        لم تجد إجابتك؟{' '}
        <Link to="/contact" className="text-brand-700 font-bold hover:underline">تواصل معنا مباشرة</Link>
      </p>
    </LegalShell>
  )
}

// ============================================================
// اتصل بنا
// ============================================================
export function ContactPage() {
  const config = useConfigStore(s => s.config)
  const support = config?.support
  return (
    <LegalShell icon={<Phone size={26} />} title="اتصل بنا"
      subtitle="فريق خدمة العملاء جاهز لخدمتك">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-stone-200/80 rounded-2xl p-5 hover:shadow-soft hover:border-brand-200 transition-all bg-white">
          <div className="flex items-center gap-3 mb-2.5">
            <span className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <Mail size={19} className="text-brand-700" />
            </span>
            <h3 className="font-bold text-stone-800">البريد الإلكتروني</h3>
          </div>
          <p className="text-sm text-stone-500 mb-2.5">نرد خلال 24 ساعة عمل</p>
          <a href={`mailto:${support?.email ?? SUPPORT_EMAIL}`} dir="ltr"
             className="text-brand-700 font-bold hover:underline block text-left">
            {support?.email ?? SUPPORT_EMAIL}
          </a>
        </div>

        <div className="border border-stone-200/80 rounded-2xl p-5 hover:shadow-soft hover:border-brand-200 transition-all bg-white">
          <div className="flex items-center gap-3 mb-2.5">
            <span className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <Phone size={19} className="text-brand-700" />
            </span>
            <h3 className="font-bold text-stone-800">الهاتف الموحد</h3>
          </div>
          <p className="text-sm text-stone-500 mb-2.5">اتصال مباشر خلال ساعات العمل</p>
          <a href={telHref(support?.phone)} dir="ltr"
             className="text-brand-700 font-bold hover:underline block text-left tabular-nums">
            {support?.phone ?? SUPPORT_PHONE}
          </a>
        </div>

        <div className="border border-stone-200/80 rounded-2xl p-5 bg-white">
          <div className="flex items-center gap-3 mb-2.5">
            <span className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <Clock size={19} className="text-brand-700" />
            </span>
            <h3 className="font-bold text-stone-800">ساعات العمل</h3>
          </div>
          <p className="text-sm text-stone-600 font-semibold">{support?.hours ?? 'السبت - الخميس: 9ص - 9م'}</p>
          <p className="text-xs text-stone-400 mt-1.5">الطلبات المستلمة بعد ساعات العمل تُعالج في أول يوم عمل تالٍ</p>
        </div>

        <div className="border border-stone-200/80 rounded-2xl p-5 bg-white">
          <div className="flex items-center gap-3 mb-2.5">
            <span className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <MapPin size={19} className="text-brand-700" />
            </span>
            <h3 className="font-bold text-stone-800">العنوان</h3>
          </div>
          <p className="text-sm text-stone-600 font-semibold">الجمهورية اليمنية</p>
          <p className="text-xs text-stone-400 mt-1.5">الزيارات بموعد مسبق عبر الهاتف الموحد</p>
        </div>
      </div>

      <div className="bg-brand-50/70 border border-brand-100 rounded-2xl p-5">
        <h3 className="font-bold text-stone-800 mb-2 flex items-center gap-2">
          <Truck size={18} className="text-brand-700" /> لمتابعة طلبك
        </h3>
        <p className="text-sm text-stone-600 leading-relaxed">
          أسرع طريقة لمتابعة طلبك أو فاتورتك هي صفحة{' '}
          <Link to="/orders" className="text-brand-700 font-bold hover:underline">«طلباتي»</Link> —
          تعرض الحالة والفاتورة الضريبية ورمز التحقق QR فوراً دون انتظار الرد.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <div className="flex flex-col items-center gap-2 p-5 bg-stone-50 border border-stone-200/60 rounded-2xl">
          <CreditCard size={20} className="text-brand-700" />
          <span className="text-xs text-stone-600 font-bold">دفع آمن عبر بوابة مرخصة</span>
        </div>
        <div className="flex flex-col items-center gap-2 p-5 bg-stone-50 border border-stone-200/60 rounded-2xl">
          <RefreshCcw size={20} className="text-brand-700" />
          <span className="text-xs text-stone-600 font-bold">استرجاع خلال 7 أيام</span>
        </div>
        <div className="flex flex-col items-center gap-2 p-5 bg-stone-50 border border-stone-200/60 rounded-2xl">
          <ShieldCheck size={20} className="text-brand-700" />
          <span className="text-xs text-stone-600 font-bold">فاتورة ضريبية إلكترونية لكل طلب</span>
        </div>
      </div>
    </LegalShell>
  )
}

// ============================================================
// الشحن والاسترجاع — صفحة السياسات الأساسية للثقة التجارية
// ============================================================
export function ShippingReturnsPage() {
  const config = useConfigStore(s => s.config)
  const support = config?.support
  return (
    <LegalShell icon={<Truck size={26} />} title="الشحن والاسترجاع"
      subtitle="كل ما تحتاج معرفته عن التوصيل والرسوم والإرجاع — بشفافية كاملة">
      <Section title="مواعيد التوصيل">
        <p>
          نجهّز الطلبات خلال يوم عمل واحد من تأكيدها، ويصل التوصيل إلى جميع محافظات
          الجمهورية اليمنية خلال ٢-٤ أيام عمل. قد تتأخر بعض المناطق النائية يومين إضافيين
          لظروف شركات الشحن، وسنخبرك بأي تأثير على طلبك عبر بيانات التواصل المسجلة.
        </p>
        <p>
          تصلك رسالة تأكيد فور إتمام الطلب تحتوي رقم الطلب ورقم الفاتورة الضريبية،
          ويمكنك متابعة الحالة مباشرة من صفحة «طلباتي» في حسابك دون الحاجة
          للتواصل مع خدمة العملاء.
        </p>
      </Section>

      <Section title="رسوم الشحن والحد المجاني">
        <p>
          رسوم الشحن الموحدة <b>٢٥ ر.س</b> لكل الطلبات داخل الجمهورية اليمنية، و<strong>الشحن مجاني</strong> لأي
          طلب يبلغ مجموعه <b>٥٠٠ ر.س</b> أو أكثر. يظهر المبلغ النهائي للشحن بوضوح في
          سلة التسوق وصفحة إتمام الطلب قبل التأكيد — لا رسوم مخفية إطلاقاً.
        </p>
      </Section>

      <Section title="التوصيل السليم">
        <p>
          نغلّف المنتجات القابلة للكسر بعناية مضاعفة، ونتحقق من المحتوى قبل
          الشحن. إذا وصلك طلبك تالفاً أو ناقصاً، تواصل معنا خلال <b>٤٨ ساعة</b> من
          الاستلام مع صورة للطلب، وسنعالج الأمر فوراً بإرسال بديل أو استرجاع
          كامل للمبلغ حسب رغبتك.
        </p>
      </Section>

      <Section title="سياسة الإرجاع خلال ١٤ يوماً">
        <p>
          يحق لك إرجاع أي منتج خلال <b>١٤ يوماً</b> من تاريخ الاستلام بشرط أن يكون
          بحالته الأصلية وكامل ملحقاته وتغليفه، ومع فاتورة الشراء. استثناءات
          بسيطة لأسباب صحية وتنظيمية: المواد الغذائية (قهوة، عسل، تمر) والعناية
          الشخصية لا تُرجع بعد فتح غلافها الأصلي.
        </p>
        <p>
          الإرجاع مجاني إذا كان الخطأ من طرفنا (منتج خاطئ أو معيب)، وتُخصم رسوم
          شحن الإرجاع (٢٥ ر.س) إذا كان الإرجاع لرغبتك الشخصية. يُرد المبلغ إلى
          وسيلة الدفع الأصلية خلال ٥-١٠ أيام عمل من استلامنا للمنتج.
        </p>
      </Section>

      <Section title="كيف أبدأ عملية إرجاع؟">
        <p>
          تواصل معنا عبر <a href={telHref(support?.phone)} className="text-brand-700 font-bold hover:underline" dir="ltr">{support?.phone ?? SUPPORT_PHONE}</a> أو
          البريد <a href={`mailto:${support?.email ?? SUPPORT_EMAIL}`} className="text-brand-700 font-bold hover:underline" dir="ltr">{support?.email ?? SUPPORT_EMAIL}</a> برقم
          طلبك وسبب الإرجاع، وسنرشدك خطوة بخطوة ونرتب استلام الشحنة من عنوانك.
        </p>
      </Section>
    </LegalShell>
  )
}
