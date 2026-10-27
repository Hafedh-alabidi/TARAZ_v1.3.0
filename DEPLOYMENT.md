# 🚀 دليل نشر نظام طراز للإنتاج التجاري

دليل كامل خطوة بخطوة لإطلاق متجر طراز على خادم إنتاج حقيقي بدومين خاص — **بدون أي ذكر لمنصة التطوير**.

> **حالة المنصة:** يمنية بالكامل (ضريبة مبيعات 5%، شحن للمحافظات، نصوص قانونية يمنية) — العملة ريال سعودي SAR — بوابة الدفع تدعم **جيب / Visa / Mastercard** عبر مويسر.

---

## 📋 جدول المحتويات

1. [المتطلبات والتكاليف](#-المتطلبات-والتكاليف)
2. [شراء الدومين وتجهيز الخادم](#1-شراء-الدومين-وتجهيز-الخادم)
3. [النشر بـ Docker Compose (الموصى به)](#-الطريقة-الأولى-docker-compose-الموصى-بها)
4. [تهيئة المتجر بعد أول تشغيل](#4-التهيئة-الأولى)
5. [تفعيل HTTPS مجاناً](#-إعداد-ssl-مجاناً)
6. [تفعيل بوابة الدفع الحقيقية (جيب)](#-تفعيل-بوابة-الدفع-الحقيقية)
7. [تفعيل البريد الإلكتروني](#-تفعيل-البريد-الإلكتروني)
8. [النسخ الاحتياطي والتحديث](#-النسخ-الاحتياطي)
9. [النشر اليدوي بدون Docker](#️-الطريقة-الثانية-نشر-يدوي-vps-بدون-docker)
10. [استكشاف الأخطاء](#-استكشاف-الأخطاء)
11. [قائمة فحص ما قبل الإطلاق](#-قائمة-فحص-ما-قبل-الإطلاق-التجاري)

---

## 📋 المتطلبات والتكاليف

| المتطلب | المواصفات | التكلفة التقريبية |
|---------|-----------|------------------|
| خادم Linux (Ubuntu 22.04+) | 2 vCPU / 4GB RAM / 40GB SSD | 6–12$ شهرياً (Hetzner / DigitalOcean / Contabo) |
| Docker + Docker Compose | 24+ / v2 | مجاني |
| اسم نطاق (Domain) | مثال: taraz.com أو taraz.store | 10–15$ سنوياً (Namecheap / Cloudflare / GoDaddy) |
| شهادة SSL | Let's Encrypt | **مجانية** وتتجدد تلقائياً |
| بوابة الدفع | مويسر Moyasar (جيب/Visa/MC) | 2.5% + 1 ر.س لكل عملية (تُخصم من العمولة، لا رسوم ثابتة) |

> 💡 **نطاق عربي اختياري:** يمكنك حجز `طراز.com` (IDN) — يعمل بنفس الطريقة، لكن ننصح للبداية بنطاق لاتيني أسهل في الكتابة والمشاركة.

---

## 1. شراء الدومين وتجهيز الخادم

### أ) شراء الدومين

1. سجّل في **Namecheap** أو **Cloudflare Registrar** أو **GoDaddy**
2. ابحث عن الاسم المتاح (مثل `taraz.store` — امتداد المتاجر — أو `taraz-yemen.com`)
3. اشترِه وفعّل **DNS** لدى نفس المزود

### ب) ربط الدومين بالخادم

بعد استلام IP الخادم من مزود الاستضافة، أنشئ سجلات DNS:

| النوع | الاسم | القيمة | الغرض |
|------|------|--------|-------|
| A | `@` | `IP-الخادم` | المتجر الرئيسي |
| A | `www` | `IP-الخادم` | النسخة بـ www |
| A | `pos` | `IP-الخادم` | لوحة نقطة البيع (اختياري) |

انتظر 5–30 دقيقة حتى ينتشر DNS (تحقق بـ `ping taraz.com`).

### ج) تجهيز الخادم

```bash
# اتصل بالخادم
ssh root@IP-الخادم

# تحديث النظام
apt update && apt upgrade -y

# تثبيت Docker
curl -fsSL https://get.docker.com | sh

# جدار حماية — افتح فقط ما نحتاج
ufw allow OpenSSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable

# إنشاء مستخدم تشغيل (أفضل أمنياً من root)
adduser taraz
usermod -aG docker,sudo taraz
su - taraz
```

---

## 🐳 الطريقة الأولى: Docker Compose (الموصى بها)

### 2. رفع المشروع إلى الخادم

```bash
# الخيار أ) عبر Git (الأفضل — جهّز مستودعاً خاصاً على GitHub)
git clone https://github.com/USERNAME/taraz.git taraz
cd taraz

# الخيار ب) عبر النسخ المباشر (حزمة taraz-deploy.zip)
# ارفعها بـ: scp taraz-deploy.zip taraz@IP-الخادم:~/ ثم:
unzip taraz-deploy.zip -d taraz
cd taraz
```

### 3. إعداد متغيرات البيئة

```bash
# نسخ النموذج
cp .env.example .env

# توليد القيم السرية تلقائائياً
SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
DBPASS=$(openssl rand -hex 16)

# كتابة ملف الإعداد — عدّل الدومين إن اختلف عن taraz.com
cat > .env << EOF
SECRET_KEY=$SECRET
ALLOWED_HOSTS=taraz.com,www.taraz.com
CORS_ALLOWED_ORIGINS=https://taraz.com,https://www.taraz.com
CSRF_TRUSTED_ORIGINS=https://taraz.com,https://www.taraz.com
DB_PASSWORD=$DBPASS
DB_NAME=taraz
DB_USER=taraz
TIME_ZONE=Asia/Aden
SECURE_SSL_REDIRECT=False
TARAZ_PAYMENT_PROVIDER=simulated
TARAZ_TAX_RATE=0.05
TARAZ_SUPPORT_EMAIL=DigitalCreativityteam5@gmail.com
TARAZ_SUPPORT_PHONE=00967 777279161
EOF

chmod 600 .env   # حماية صلاحيات الملف — لا تشاركه أبداً
```

> ✅ **حرّاس الإنتاج المدمجون:** عند `DEBUG=False` يرفض Django الإقلاع إذا كانت
> `SECRET_KEY` معروفة/قصيرة أو `ALLOWED_HOSTS` تحتوي `*` — الخطأ يظهر بوضوح في السجلات.
> لن يدخل ملف `taraz_backend/.env` التطويري إلى الحاوية (راجع `.dockerignore`).

### تشغيل النظام الكامل

```bash
docker compose up -d --build
```

سيتم تشغيل 4 خدمات:

| الخدمة | الوصف | المنفذ |
|--------|-------|--------|
| **db** | PostgreSQL 16 (حجم دائم) | داخلي |
| **backend** | Django + Gunicorn (4 عمّال) | داخلي |
| **marketplace** | المتجر الإلكتروني | 80 → 443 |
| **desktop** | لوحة نقطة البيع | 3000 |

> 🖥️ **لوحة نقطة البيع:** بالوضع الحالي تُخدم على المنفذ 3000. للوصول إليها من
> `pos.taraz.com` بدل المنفذ: أضف سجل DNS، ثم انقل خدمة desktop خلف بروكسي عكسي،
> أو ببساطة افتح `http://taraz.com:3000` بعد فتح المنفذ في ufw (`ufw allow 3000`)
> — وتُستخدم داخلياً من الكاشير فقط.

---

## 4. التهيئة الأولى

```bash
# ✅ الإنتاج: أنشئ المشرف يدوياً فقط — أمر seed_data يرفض العمل في الإنتاج
# تلقائياً (حماية من حسابات بكلمات مرور ثابتة معروفة)
docker compose exec backend python manage.py createsuperuser

# (اختياري) تحميل بيانات كتالوج مبدئية عبر لوحة الإدارة أو API
```

> ⚠️ **لا تستخدم بيانات التطوير في الإنتاج** — الحسابات التجريبية (admin/Admin@2026)
> تُنشأ فقط في وضع التطوير، و`seed_data` يرفض إنشائها عند `DEBUG=False`.
> أنشئ حسابك الإداري بكلمة مرور قوية فريدة من `createsuperuser`.

### حسابات الإدارة الثلاث

| اللوحة | الرابط | الاستخدام |
|--------|--------|-----------|
| لوحة Django | `https://taraz.com/admin/` | إدارة كاملة: منتجات، صور، طلبات، مستخدمون |
| نقطة البيع POS | `https://taraz.com:3000` | بيع مباشر، كاشير، مخزون، موردين |
| توثيق API | `https://taraz.com/api/docs/` | Swagger للتكاملات |

---

## 🔒 إعداد SSL مجاناً

### الطريقة أ) Cloudflare (الأسهل — 5 دقائق)

1. أضف موقعك إلى Cloudflare وحدّث Nameservers لدى مسجل الدومين
2. فعّل Proxy (السحابة البرتقالية) على سجلات A
3. SSL/TLS → وضع **Full (Strict)**
4. في `.env` أبقِ `SECURE_SSL_REDIRECT=False` (Cloudflare ينهي SSL)
5. `docker compose up -d` لإعادة التحميل

### الطريقة ب) Let's Encrypt على الخادم

```bash
# تثبيت certbot
sudo apt install certbot -y

# الحصول على الشهادة (وضع standalone — أوقف nginx مؤقتاً)
docker compose stop marketplace
sudo certbot certonly --standalone -d taraz.com -d www.taraz.com
docker compose start marketplace

# الشهادات الآن في /etc/letsencrypt/live/taraz.com/
# فعّل بلوك HTTPS في nginx-frontend.conf (موجود معلقاً وجاهزاً):
#   1) أنشئ مجلد ./certs وانسخ الشهادات إليه
#   2) أزل التعليقات عن بلوك 443 وإعادة توجيه 80
#   3) فعّل منفذ 443 ومجلد الشهادات في docker-compose.yml
#   4) في .env اجعل SECURE_SSL_REDIRECT=True ثم docker compose up -d

# التجديد التلقائي (تُجدَّد كل 90 يوماً)
echo "0 3 * * * certbot renew --quiet && docker compose -f /home/taraz/taraz/docker-compose.yml restart marketplace" | sudo crontab -
```

---

## 💳 تفعيل بوابة الدفع الحقيقية

المنصة تدعم **جيب / Visa / Mastercard / Apple Pay** عبر بوابة **مويسر** السعودية (تعمل مع العملة SAR).

### الخطوات

1. سجّل حساب تاجر في [dashboard.moyasar.com](https://dashboard.moyasar.com)
   - ستحتاج سجلاً تجارياً وحساباً بنكياً (يمكن بحساب فردي أيضاً للاشتراك Lite)
2. من الإعدادات → **API Keys** انسخ:
   - **Secret Key** (تبدأ بـ `sk_`)
   - **Publishable Key** (تبدأ بـ `pk_`)
3. حدّث `.env`:

```bash
TARAZ_PAYMENT_PROVIDER=moyasar
MOYASAR_SECRET_KEY=sk_live_XXXXXXXXXXXX
MOYASAR_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXX
```

4. أعد التشغيل:

```bash
docker compose up -d backend
```

5. **اختبر ببطاقة حقيقية صغيرة** (مثلاً منتج بـ 5 ر.س) وتأكد من وصول المبلغ واستعادته

> 🔁 **للرجوع لوضع المعاينة** (دون خصم حقيقي): اجعل `TARAZ_PAYMENT_PROVIDER=simulated`
> — البطاقات التجريبية: `4111111111111111` (جيب/Visa — ناجحة)، `4222222222222222` (مرفوضة).

> ⚠️ **ملاحظة:** بوابة مويسر تعالج بالريال السعودي وهو ما يطابق عملة متجرك (SAR).
> إن قررت مستقبلاً التحول للريال اليمني (YER) سيلزم حينها مراجعة البوابة والأسعار.

---

## 📧 تفعيل البريد الإلكتروني

مطلوب لعمل **استعادة كلمة المرور** وإشعارات الطلبات. بدون بريد حقيقي، الرسائل تُطبع في سجلات الحاوية فقط (وضع console).

### عبر Gmail (الأبسط للبداية)

1. فعّل التحقق بخطوتين على حساب Gmail
2. أنشئ **كلمة مرور تطبيق** من: myaccount.google.com → Security → App passwords
3. في `.env`:

```bash
EMAIL_BACKEND=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=yourstore@gmail.com
EMAIL_HOST_PASSWORD=xxxx-xxxx-xxxx-xxxx   # كلمة مرور التطبيق وليس كلمة الحساب
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=طراز <yourstore@gmail.com>
```

4. `docker compose up -d backend`
5. اختبر: صفحة «نسيت كلمة المرور» في المتجر → أدخل بريدك → يجب أن تصلك رسالة

### مزودون أفضل للتوسع

| المزود | الحد المجاني | مناسب لـ |
|--------|-------------|----------|
| Brevo (سابقاً Sendinblue) | 300 رسالة/يوم | البداية — الأفضل قيمة |
| SendGrid | 100 رسالة/يوم | تجربة |
| Mailgun | تجربة 3 أشهر | التوسع |

---

## 💾 النسخ الاحتياطي

```bash
# نسخة احتياطية يومية 3 فجراً (cron)
echo "0 3 * * * docker compose -f /home/taraz/taraz/docker-compose.yml exec -T db pg_dump -U taraz taraz | gzip > /backup/taraz-\$(date +\%F).sql.gz" | sudo crontab -

# ⚠️ أنشئ مجلد النسخ أولاً واربطه بحجم خارجي:
sudo mkdir -p /backup

# الاستعادة (اختبرها فعلياً مرة واحدة على الأقل!)
gunzip -c /backup/taraz-2026-10-27.sql.gz | docker compose exec -T db psql -U taraz taraz

# نسخ صور المنتجات (الوسائط)
docker compose exec backend tar czf - /app/media > /backup/media-$(date +%F).tar.gz
```

## 🔄 التحديث بنسخة أحدث من المشروع

```bash
cd /home/taraz/taraz
git pull            # أو ارفع الملفات المعدلة
docker compose up -d --build backend marketplace desktop
docker compose exec backend python manage.py migrate --noinput
```

## 📊 المراقبة

- **فحص الصحة**: `GET /api/health/` — استخدمه مع UptimeRobot مجاناً (تنبيه عند التوقف)
- **السجلات**: `docker compose logs -f backend`
- **الأداء**: `docker stats` — إن ارتفع الحمل زد `--workers` في Dockerfile

---

## 🖥️ الطريقة الثانية: نشر يدوي (VPS بدون Docker)

<details>
<summary>اضغط لعرض الخطوات اليدوية الكاملة</summary>

### 1. الخادم الخلفي

```bash
sudo apt update && sudo apt install python3.11 python3-pip postgresql nginx -y

sudo -u postgres psql << EOF
CREATE DATABASE taraz;
CREATE USER taraz WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE taraz TO taraz;
EOF

cd taraz_backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt gunicorn

cp .env.example .env   # عدّل القيم — أضف متغيرات DB و SECRET_KEY و الدومين

python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

### 2. خدمة systemd لـ Gunicorn

```bash
sudo tee /etc/systemd/system/taraz.service << 'EOF'
[Unit]
Description=Taraz Backend (Gunicorn)
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/taraz/taraz_backend
Environment="PATH=/opt/taraz/taraz_backend/venv/bin"
EnvironmentFile=/opt/taraz/taraz_backend/.env
ExecStart=/opt/taraz/taraz_backend/venv/bin/gunicorn \
    taraz_backend.wsgi:application \
    --workers 4 \
    --bind unix:/run/taraz.sock \
    --access-logfile /var/log/taraz/access.log \
    --error-logfile /var/log/taraz/error.log
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now taraz
```

### 3. بناء الواجهات

```bash
cd taraz_marketplace
npm ci
npm run build     # VITE_API_URL=/api افتراضياً — نفس الدومين عبر nginx

cd ../taraz_desktop
npm ci
npm run build
```

### 4. إعداد nginx

انسخ إعداد nginx من قسم الطريقة اليدوية في المستودع، أو استخدم الملف
`nginx-frontend.conf` كمرجع (توجيه `/api/` و `/static/` و `/media/` و `/admin/`
إلى gunicorn + خدمة ملفات `dist` مع SPA fallback).

```bash
sudo nginx -t && sudo systemctl reload nginx
```

</details>

---

## 🔥 استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| 502 Bad Gateway | `docker compose logs backend` — تحقق من تشغيل Gunicorn |
| CSRF / CORS أخطاء | أضف نطاقك في `CORS_ALLOWED_ORIGINS` و `CSRF_TRUSTED_ORIGINS` بـ `.env` |
| قاعدة البيانات لا تتصل | تحقق من `DB_PASSWORD` وتطابقه في compose و .env |
| الملفات الثابتة 404 | `docker compose exec backend python manage.py collectstatic` |
| لا تصدر رسائل البريد | راجع قسم البريد — وضع console يطبع في السجلات فقط |
| الدفع يرفض كل البطاقات | لا تزال على وضع `simulated` — راجع قسم بوابة الدفع |
| بطء الاستجابة | زد `--workers` (قاعدة 2× عدد الأنوية) وراقب `docker stats` |
| المتجر لا يفتح بعد تغيير DNS | انتظر انتشار DNS (حتى 30 د) — `ping taraz.com` |

---

## ✅ قائمة فحص ما قبل الإطلاق التجاري

### الأسرار والإعدادات
- [ ] `DEBUG=False` وملف `.env` بصلاحيات 600 ولا يُرفع لأي مستودع
- [ ] `SECRET_KEY` قوي وفريد (50+ حرفاً) — الحرّاس يرفضون غير ذلك
- [ ] `ALLOWED_HOSTS` و `CORS_ALLOWED_ORIGINS` و `CSRF_TRUSTED_ORIGINS` بالنطاق الفعلي فقط (بلا `*`)
- [ ] لا حسابات تجريبية في قاعدة الإنتاج (استخدم `createsuperuser`)
- [ ] `TIME_ZONE=Asia/Aden` و `TARAZ_TAX_RATE=0.05`

### الأمان
- [ ] SSL/HTTPS مفعّل ومجدد تلقائياً + `SECURE_SSL_REDIRECT=True` بعد تفعيل الشهادة
- [ ] جدار الحماية ufw يسمح فقط بـ 22 و 80 و 443
- [ ] اختبار يدوي: عميل يحاول إرسال `channel=pos` أو `discount` → يجب أن يُرفض 403
- [ ] اختبار يدوي: صفحة منتج كزائر → لا تظهر التكلفة/المورد/الكميات
- [ ] حدود الطلبات مضبوطة (`THROTTLE_AUTH` للدخول والتسجيل)
- [ ] سياسة الرموز: `TARAZ_TOKEN_TTL_DAYS` مناسبة لسياسة الشركة

### المدفوعات والبريد
- [ ] `TARAZ_PAYMENT_PROVIDER=moyasar` مع مفاتيح حقيقية — أو `simulated` مع إخبار العملاء أنها معاينة
- [ ] اختبار دفع حقيقي بمنتج رخيص + التحقق من التسوية البنكية
- [ ] البريد مفعّل — «نسيت كلمة المرور» تصل فعلاً للبريد
- [ ] بيانات الدعم صحيحة (البريد والهاتف اليمني)

### التشغيل
- [ ] `python manage.py test` — 85/85 ناجحة قبل النشر
- [ ] النسخ الاحتياطي اليومي مجدول **ومُختبر استعادته فعلياً**
- [ ] مراقبة `/api/health/` مفعّلة (UptimeRobot)
- [ ] اختبار دورة شراء كاملة (تسجيل → سلة → دفع → تتبع) على الدومين الحقيقي
- [ ] اختبار نقطة بيع كاملة (بيع → إيصال → خصم مخزون)
- [ ] اختبار استرجاع/إلغاء مع التحقق من إرجاع المخزون مرة واحدة
- [ ] الصفحات القانونية (الشروط/الخصوصية/الاسترجاع/الشحن) مطابقة لمتطلبات السوق اليمني
