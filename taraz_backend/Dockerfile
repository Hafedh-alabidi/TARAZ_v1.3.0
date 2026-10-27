# ============================================================
# طراز — خادم Django للإنتاج
# ============================================================
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# تثبيت psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# التبعيات
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# الكود
COPY . .

# جمع الملفات الثابتة — يفشل البناء عند أي خطأ (لا إخفاء أعطال)
# DEBUG=True وقت البناء فقط لتجاوز حرّاس الإنتاج (لا خادم يعمل هنا،
# والسرّ الحقيقي يُمرَّر عند التشغيل عبر متغيرات البيئة)
RUN DEBUG=True python manage.py collectstatic --noinput

# مستخدم غير جذري
RUN adduser --disabled-password --gecos '' taraz && chown -R taraz:taraz /app
USER taraz

EXPOSE 8000

# فحص الصحة
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

# تشغيل gunicorn للإنتاج
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn taraz_backend.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 60 --access-logfile -"]
