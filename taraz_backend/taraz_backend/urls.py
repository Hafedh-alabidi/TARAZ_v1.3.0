from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import path, include
from rest_framework import routers
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from users.views import (UserViewSet, LoginView, RegisterView, LogoutView,
                         PasswordResetRequestView, PasswordResetConfirmView)
from inventory.views import (
    ProductViewSet, CategoryViewSet, SupplierViewSet, InventoryViewSet, StockMovementViewSet
)
from orders.views import (
    OrderViewSet, PaymentViewSet, CommissionViewSet, DashboardStatsView
)

router = routers.DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'inventory', InventoryViewSet, basename='inventory')       # ✅ كان مفقوداً
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')  # ✅ سجل تدقيق المخزون
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'commissions', CommissionViewSet, basename='commission')   # ✅ كان مفقوداً


class HealthCheckView(APIView):
    """
    فحص صحة الخدمة — للمراقبة و load balancers.
    ✅ أمن: أقل قدر ممكن من المعلومات للعامة — لا تفاصيل قاعدة البيانات
    أو الإصدارات (تقليل البصمة المعلوماتية).
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        from django.db import connection
        db_ok = True
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
        except Exception:
            db_ok = False
        if not db_ok:
            return Response({'status': 'degraded'}, status=503)
        return Response({'status': 'ok'})


class ThrottledObtainAuthToken(ObtainAuthToken):
    """
    ✅ إصلاح أمني (P0): مسار /api/auth/token/ كان بلا أي تحديد معدل —
    فكان يتجاوز حد 10/دقيقة المفروض على مسار الدخول العادي، مما يتيح
    هجمات تخمين بيانات الدخول عبره. الآن يخضع لنفس النطاق المشدد 'auth'.
    """
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'
    # ✅ إصلاح CSRF: نقطة دخول عامة بالرموز — بلا SessionAuthentication
    # حتى لا يفشل الطلب لمن لديه جلسة Django admin نشطة (CSRF token missing)
    authentication_classes = []
    permission_classes = [AllowAny]


class PublicConfigView(APIView):
    """
    إعدادات الأعمال العامة للواجهات الأمامية — بلا أي أسرار:
    هل الدفع الإلكتروني مفعل ومن أي مزود، وبيانات التواصل، والضريبة.
    تتيح للواجهة إظهار/إخفاء خيارات الدفع وشعاراته بصدق حسب الواقع الفعلي.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    # قراءة فقط خفيفة — لا حاجة لتحديد معدل خاص فوق الحد العام

    def get(self, request):
        provider = settings.TARAZ_PAYMENT_PROVIDER
        return Response({
            'store_name': settings.TARAZ_SELLER_NAME,
            'currency': 'SAR',
            'tax_rate': settings.TARAZ_TAX_RATE,
            'free_shipping_threshold': settings.TARAZ_FREE_SHIPPING_THRESHOLD,
            'payment': {
                'provider': provider,
                # وضع المحاكاة يُعلن صراحة حتى لا تُظن عمليات حقيقية
                'simulated': provider == 'simulated',
                'card_enabled': provider in ('moyasar', 'simulated'),
                'label': {
                    'moyasar': 'بوابة مويسر (جيب / Visa / Mastercard)',
                    'simulated': 'بوابة دفع تجريبية (وضع المحاكاة)',
                    'none': 'الدفع عند الاستلام أو تحويل بنكي',
                }.get(provider, 'الدفع عند الاستلام'),
            },
            'support': {
                'email': settings.TARAZ_SUPPORT_EMAIL,
                'phone': settings.TARAZ_SUPPORT_PHONE,
                'hours': 'السبت - الخميس: 9ص - 9م',
            },
        })


class SitemapView(APIView):
    """
    ✅ SEO (P2): خريطة موقع XML ديناميكية — الصفحات الثابتة + صفحات
    المنتجات النشطة، بروابط الواجهة من إعداد FRONTEND_URL.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        from django.utils import timezone
        from inventory.models import Product
        base = settings.FRONTEND_URL.rstrip('/')
        now = timezone.now().strftime('%Y-%m-%d')
        urls = [
            {'loc': f'{base}/', 'priority': '1.0'},
            {'loc': f'{base}/products', 'priority': '0.9'},
            {'loc': f'{base}/cart', 'priority': '0.5'},
            {'loc': f'{base}/faq', 'priority': '0.4'},
            {'loc': f'{base}/contact', 'priority': '0.4'},
            {'loc': f'{base}/terms', 'priority': '0.3'},
            {'loc': f'{base}/privacy', 'priority': '0.3'},
        ]
        for p in Product.objects.filter(is_active=True).only('id')[:500]:
            urls.append({'loc': f'{base}/products/{p.id}', 'priority': '0.7'})
        xml = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        for u in urls:
            xml.append(
                f'<url><loc>{u["loc"]}</loc><lastmod>{now}</lastmod>'
                f'<priority>{u["priority"]}</priority></url>')
        xml.append('</urlset>')
        return HttpResponse('\n'.join(xml), content_type='application/xml')


urlpatterns = [
    # ✅ تحصين (P2): مسار لوحة الإدارة قابل للتخصيص عبر ADMIN_URL_PATH
    # في الإنتاج — لا يبقى على المسار الافتراضي المعروف للمهاجمين
    path(f'{settings.ADMIN_URL_PATH.strip("/")}/', admin.site.urls),
    # فحص الصحة
    path('api/health/', HealthCheckView.as_view(), name='health'),
    # خريطة الموقع (SEO)
    path('sitemap.xml', SitemapView.as_view(), name='sitemap'),
    # إعدادات الأعمال العامة
    path('api/config/', PublicConfigView.as_view(), name='public-config'),
    # توثيق API (Swagger / OpenAPI)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # المصادقة
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/logout/', LogoutView.as_view(), name='logout'),
    path('api/auth/token/', ThrottledObtainAuthToken.as_view(), name='token'),
    # ✅ استعادة كلمة المرور
    path('api/auth/password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('api/auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    # لوحة التحكم والتقارير
    path('api/dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    # الـ APIs
    path('api/', include(router.urls)),
]

# ✅ تحصين (P2): واجهة DRF القابلة للتصفح للتطوير فقط —
# لا مبرر تشغيلياً لها في الإنتاج (Swagger يغطي التوثيق)
if settings.DEBUG:
    urlpatterns += [
        path('api-auth/', include('rest_framework.urls')),
    ]

# خدمة الملفات الثابتة والوسائط أثناء التطوير
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
