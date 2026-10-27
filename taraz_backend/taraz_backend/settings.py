"""
إعدادات مشروع طراز — جاهزة للإنتاج عبر متغيرات البيئة (.env)

✅ حراس الإنتاج: عند DEBUG=False يرفض الخادم الإقلاع بقيم تطوير غير آمنة
(Secret Key معروفة أو ALLOWED_HOSTS="*") — راجع آخر الملف.
"""
import os
from datetime import timedelta
from pathlib import Path

from decouple import config, Csv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# ============================================================
# الأمان الأساسي (يُقرأ من متغيرات البيئة — لا تضع أسراراً هنا)
# ============================================================
SECRET_KEY = config(
    'SECRET_KEY',
    default='django-insecure-change-me-in-production-env-file'
)
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# ✅ نشر Render: يضيف Render اسم المضيف الخارجي تلقائياً — بلا حاجة لتعديل ALLOWED_HOSTS يدوياً
if os.environ.get('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(os.environ['RENDER_EXTERNAL_HOSTNAME'])

# ✅ أصول موثوقة لـ CSRF — تشمل نطاق المعاينة العامة حتى تعمل لوحة تحكم Django
# (تسجيل الدخول POST) عبر الرابط نفسه بدل localhost فقط
CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default=(
        'https://preview-chat-b0f7023b-66a9-4e32-a549-7b48088b3e68.space-z.ai,'
        'http://localhost:3000,http://127.0.0.1:3000,'
        'http://localhost:5173,http://127.0.0.1:5173'
    ),
    cast=Csv(),
)

# ============================================================
# التطبيقات المثبتة
# ============================================================
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # طرف ثالث
    'rest_framework',
    'rest_framework.authtoken',   # ✅ إصلاح: كان مفقوداً رغم استخدام Token
    'corsheaders',
    'django_filters',
    'drf_spectacular',            # ✅ توثيق OpenAPI/Swagger
    # تطبيقات طراز
    'users',
    'inventory',
    'orders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # ✅ whitenoise: خدمة الملفات الثابتة مباشرة من Django/gunicorn (Render / بلا nginx)
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'taraz_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'taraz_backend.wsgi.application'
ASGI_APPLICATION = 'taraz_backend.asgi.application'

# ============================================================
# قاعدة البيانات: PostgreSQL في الإنتاج، SQLite للتطوير
# ============================================================
DATABASES = {
    'default': {
        'ENGINE': config('DB_ENGINE', default='django.db.backends.sqlite3'),
        'NAME': config('DB_NAME', default=str(BASE_DIR / 'db.sqlite3')),
        'USER': config('DB_USER', default='taraz'),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

# ============================================================
# المصادقة
# ============================================================
AUTH_USER_MODEL = 'users.User'   # ✅ إصلاح حرج: كان مفقوداً

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ============================================================
# DRF: Token auth (منتهية الصلاحية) + صلاحيات + حد الطلبات + ترقيم
# ============================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # ✅ أمن: رموز تنتهي صلاحيتها بدل رموز دائمة العمر
        'users.authentication.ExpiringTokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'taraz_backend.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': config('THROTTLE_ANON', default='60/min'),
        'user': config('THROTTLE_USER', default='600/min'),
        # ✅ أمن: حد مشدد لمسارات الدخول/التسجيل/استعادة كلمة المرور ضد التخمين (ScopedRateThrottle)
        'auth': config('THROTTLE_AUTH', default='10/min'),
    },
    # ✅ توثيق API — مخطط OpenAPI 3 لسواجر
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'TARAZ API',
    'DESCRIPTION': 'واجهات برمجة تطبيقات منصة طراز — متجر إلكتروني + نقطة بيع + إدارة مخزون',
    'VERSION': '1.1.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
}

# ============================================================
# CORS — يُدار من متغيرات البيئة
# ============================================================
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173',
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

# ============================================================
# التعريب والمنطقة الزمنية
# ============================================================
LANGUAGE_CODE = 'ar'
TIME_ZONE = config('TIME_ZONE', default='Asia/Aden')
USE_I18N = True
USE_TZ = True

# ============================================================
# الملفات الثابتة والوسائط
# ============================================================
STATIC_URL = '/static/'
STATIC_ROOT = config('STATIC_ROOT', default=str(BASE_DIR / 'staticfiles'))
MEDIA_URL = '/media/'
MEDIA_ROOT = config('MEDIA_ROOT', default=str(BASE_DIR / 'media'))

# ✅ whitenoise: ضغط الملفات الثابتة وخدمتها بكفاءة (متوافق Django 5.2)
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ============================================================
# إعدادات أمان إضافية تعمل تلقائياً في الإنتاج
# ============================================================
if not DEBUG:
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = 'DENY'
    # ثقة رأس البروتوكول من reverse proxy فقط (nginx يمرر X-Forwarded-Proto)
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

    # --------------------------------------------------------
    # ✅ حرّاس الإنتاج: رفض الإقلاع بقيم تطوير غير آمنة
    # --------------------------------------------------------
    _INSECURE_SECRET_MARKERS = (
        'django-insecure', 'dev-taraz-local-key', 'change-me',
        'change-me-in-production', 'insecure',
    )
    _secret_lower = SECRET_KEY.lower()
    if (len(SECRET_KEY) < 32
            or any(m in _secret_lower for m in _INSECURE_SECRET_MARKERS)):
        raise ImproperlyConfigured(
            'SECRET_KEY غير آمنة للإنتاج — ولّد مفتاحاً عشوائياً '
 '(python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())") '
            'وضعه في متغير البيئة SECRET_KEY ثم أعد التشغيل.'
        )
    if '*' in ALLOWED_HOSTS or not ALLOWED_HOSTS:
        raise ImproperlyConfigured(
            'ALLOWED_HOSTS لا يجوز أن تكون "*" أو فارغة في الإنتاج — '
            'حدد نطاقات المتجر ولوحة الإدارة صراحةً في متغير البيئة.'
        )

# ============================================================
# البريد الإلكتروني — SMTP في الإنتاج، طرفية الطور في التطوير
# ✅ أساس إشعارات الطلبات واستعادة كلمة المرور
# ============================================================
if config('EMAIL_BACKEND', default='') == 'smtp':
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
EMAIL_HOST = config('EMAIL_HOST', default='smtp.example.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='TARAZ <no-reply@taraz.local>')

# عنوان الواجهة الأمامية — لبناء روابط البريد (استعادة كلمة المرور)
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')

# ============================================================
# إعدادات أعمال طراز: الضريبة والشحن والعمولة
# ============================================================
TARAZ_TAX_RATE = config('TARAZ_TAX_RATE', default=0.05, cast=float)      # الضريبة العامة على المبيعات (اليمن) 5%
TARAZ_SHIPPING_FLAT = config('TARAZ_SHIPPING_FLAT', default=25, cast=float)  # شحن ثابت
TARAZ_FREE_SHIPPING_THRESHOLD = config('TARAZ_FREE_SHIPPING_THRESHOLD', default=500, cast=float)
TARAZ_COMMISSION_RATE = config('TARAZ_COMMISSION_RATE', default=5.0, cast=float)  # نسبة العمولة %

# ============================================================
# ✅ الفاتورة الإلكترونية المبسطة (رمز QR بترميز TLV):
# بيانات البائع التي تُرمَّز داخل رمز QR بترميز TLV
# ============================================================
TARAZ_SELLER_NAME = config('TARAZ_SELLER_NAME', default='متجر طراز')
TARAZ_VAT_NUMBER = config('TARAZ_VAT_NUMBER', default='100200300')  # الرقم الضريبي (يُضبط للإنتاج)

# ============================================================
# ✅ بوابة الدفع الإلكتروني:
#   - 'moyasar'    : تكامل حقيقي مع مويسر (يتطلب MOYASAR_SECRET_KEY)
#   - 'simulated'  : بوابة محاكاة كاملة للتدريب/القبول (بطاقات تجريبية فقط)
#   - 'none'       : بلا دفع إلكتروني (الدفع عند الاستلام/تحويل فقط)
# ============================================================
TARAZ_PAYMENT_PROVIDER = config('TARAZ_PAYMENT_PROVIDER', default='simulated')
MOYASAR_SECRET_KEY = config('MOYASAR_SECRET_KEY', default='')
MOYASAR_PUBLISHABLE_KEY = config('MOYASAR_PUBLISHABLE_KEY', default='')

# ✅ تحصين (P2): مسار لوحة إدارة Django عبر متغير بيئة —
# يُغيَّر في الإنتاج إلى مسار غير متوقع بدل /admin/ الافتراضي
ADMIN_URL_PATH = config('ADMIN_URL_PATH', default='admin')

# بيانات التواصل الدعم — تُنشر عبر /api/config/ للواجهات
TARAZ_SUPPORT_EMAIL = config('TARAZ_SUPPORT_EMAIL', default='DigitalCreativityteam5@gmail.com')
TARAZ_SUPPORT_PHONE = config('TARAZ_SUPPORT_PHONE', default='00967 777279161')

# ✅ أمن مالي: سقف الخصم الذي يجوز لموظف تطبيقه على طلب واحد (نسبة من المجموع)
TARAZ_MAX_DISCOUNT_RATIO = config('TARAZ_MAX_DISCOUNT_RATIO', default=0.5, cast=float)

# ✅ أمن جلسات: صلاحية رمز المصادقة بالأيام (يُبطَل تلقائياً بعدها)
TARAZ_TOKEN_TTL_DAYS = config('TARAZ_TOKEN_TTL_DAYS', default=30, cast=int)

# ============================================================
# السجلات (Logging) للمراقبة في الإنتاج
# ============================================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name} {module}:{lineno} - {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'verbose'},
    },
    'root': {'handlers': ['console'], 'level': config('LOG_LEVEL', default='INFO')},
}
