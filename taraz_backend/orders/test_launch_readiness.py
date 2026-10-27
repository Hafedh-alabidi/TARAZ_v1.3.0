"""
✅ اختبارات جاهزية الإطلاق (تنفيذ توصيات تقرير الفحص):

1) إغلاق ثغرة /api/auth/token/ — يجب أن يخضع لحد المعدل المشدد 'auth'.
2) الفاتورة الإلكترونية المبسطة (ZATCA المرحلة الأولى) — نقطة النهاية
   /api/orders/{id}/invoice/ ترجع رمز QR بترميز TLV صحيح البنية.
3) الدفع الإلكتروني عبر بوابة المحاكاة — إنشاء جلسة، تأكيد ناجح،
   رفض البطاقات المرفوضة، ورفض انتحال الجلسات.
4) نقطة الإعدادات العامة /api/config/ — بلا أسرار وتعلن وضع المحاكاة.
"""
import base64
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.conf import settings
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from inventory.models import Category, Supplier, Product
from orders.models import Order, OrderItem, Payment

User = get_user_model()


class LaunchBase(APITestCase):
    """إعداد بيانات اختبارات الجاهزية"""

    def setUp(self):
        self.client.default_format = 'json'
        cache.clear()

        self.admin = User.objects.create_user(
            'launchadmin', 'ladmin@test.com', 'Admin@2026',
            role='admin', is_staff=True, is_superuser=True)
        self.customer = User.objects.create_user(
            'launchcustomer', 'lcust@test.com', 'Customer@2026', role='customer')
        self.other_customer = User.objects.create_user(
            'othercustomer', 'ocust@test.com', 'Other@2026', role='customer')

        self.category = Category.objects.create(name='إلكترونيات', icon='electronics')
        self.supplier = Supplier.objects.create(
            name='مورد تجريبي', phone='0551234567', address='الرياض',
            city='الرياض', country='السعودية')
        self.product = Product.objects.create(
            name='منتج اختبار الإطلاق', category=self.category, supplier=self.supplier,
            price=Decimal('200'), cost=Decimal('120'), quantity=50, min_quantity=10,
            sku='LAUNCH-001', barcode='6280000002')

        self.customer_token = Token.objects.create(user=self.customer)
        self.other_token = Token.objects.create(user=self.other_customer)
        self.admin_token = Token.objects.create(user=self.admin)

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def auth_customer(self):
        self.auth(self.customer_token)

    def auth_other(self):
        self.auth(self.other_token)

    def auth_admin(self):
        self.auth(self.admin_token)

    def create_online_order(self, auth_token=None, payment_method='card'):
        """إنشاء طلب متجر إلكتروني باسم العميل الأساسي"""
        if auth_token:
            self.auth(auth_token)
        else:
            self.auth_customer()
        return self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 2}],
            'payment_method': payment_method,
            'shipping_name': 'عميل الإطلاق',
            'shipping_phone': '0551112222',
            'shipping_address': 'حي النخيل، شارع 10',
            'shipping_city': 'الرياض',
        })


# ============================================================
# 1) إغلاق ثغرة تحديد المعدل على /api/auth/token/
# ============================================================
class TokenEndpointThrottleTests(LaunchBase):
    """✅ P0-1: مسار token يجب أن يُخضع لنطاق 'auth' المشدد (10/دقيقة)"""

    def test_token_endpoint_is_throttled(self):
        # نتجاوز الحد — الطلب رقم 11 خلال الدقيقة يجب أن يُرفض بـ 429
        last_code = None
        for i in range(11):
            response = self.client.post('/api/auth/token/', {
                'username': 'launchcustomer', 'password': 'wrong-password'})
            last_code = response.status_code
            if last_code == 429:
                break
        self.assertEqual(last_code, 429, 'مسار token لم يُطبّق حد المعدل المشدد')


# ============================================================
# 2) الفاتورة الإلكترونية المبسطة — ZATCA TLV QR
# ============================================================
class ZatcaInvoiceTests(LaunchBase):
    """✅ P0-3: فاتورة بترميز TLV و QR قابل للفك والتحقق"""

    def _create_and_get_invoice(self):
        order_resp = self.create_online_order()
        self.assertEqual(order_resp.status_code, status.HTTP_201_CREATED)
        order_id = order_resp.data['id']
        response = self.client.get(f'/api/orders/{order_id}/invoice/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    @staticmethod
    def _parse_tlv(payload: bytes):
        """فك ترميز TLV إلى قاموس {وسم: قيمة}"""
        tags, i = {}, 0
        while i < len(payload):
            tag, length = payload[i], payload[i + 1]
            value = payload[i + 2:i + 2 + length]
            tags[tag] = value.decode('utf-8')
            i += 2 + length
        return tags

    def test_invoice_contains_tlv_qr(self):
        data = self._create_and_get_invoice()
        zatca = data['zatca']

        # حمولة Base64 قابلة للفك و بصيغة PNG
        self.assertIn('tlv_base64', zatca)
        self.assertIn('qr_png', zatca)
        self.assertTrue(zatca['qr_png'].startswith('data:image/png;base64,'))

        # فك الوسوم الخمسة والتحقق من القيم
        payload = base64.b64decode(zatca['tlv_base64'])
        tags = self._parse_tlv(payload)
        self.assertIn(settings.TARAZ_SELLER_NAME, tags[1])       # اسم البائع
        self.assertEqual(tags[2], settings.TARAZ_VAT_NUMBER)     # الرقم الضريبي
        self.assertIn('T', tags[3])                               # طابع زمني ISO
        # الإجمالي = 400 + ضريبة 5% (20) + شحن 25 = 445.00
        self.assertEqual(tags[4], '445.00')
        self.assertEqual(tags[5], '20.00')

    def test_invoice_totals_are_consistent(self):
        data = self._create_and_get_invoice()
        totals = data['totals']
        self.assertEqual(Decimal(totals['subtotal']), Decimal('400.00'))
        self.assertEqual(Decimal(totals['tax']), Decimal('20.00'))
        # 400 + ضريبة 20 + شحن 25 = 445
        self.assertEqual(Decimal(totals['final_amount']), Decimal('445.00'))
        # بيانات البائع حاضرة للفاتورة
        self.assertEqual(data['seller']['vat_number'], settings.TARAZ_VAT_NUMBER)
        self.assertTrue(data['invoice_number'].startswith('INV-'))

    def test_invoice_access_control(self):
        """العميل الآخر لا يرى فاتورة ليست له"""
        order_resp = self.create_online_order()
        order_id = order_resp.data['id']
        self.auth_other()
        response = self.client.get(f'/api/orders/{order_id}/invoice/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        # الموظف يراها
        self.auth_admin()
        response = self.client.get(f'/api/orders/{order_id}/invoice/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ============================================================
# 3) الدفع الإلكتروني — بوابة المحاكاة
# ============================================================
class SimulatedPaymentTests(LaunchBase):
    """✅ P0-4: إنشاء جلسة دفع + تأكيدها بأمان"""

    def _create_order(self):
        resp = self.create_online_order(payment_method='card')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        return resp.data['id']

    def test_initiate_payment_creates_session(self):
        order_id = self._create_order()
        response = self.client.post(f'/api/orders/{order_id}/pay/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['provider'], 'simulated')
        self.assertTrue(response.data['session_id'].startswith('SIM-'))
        self.assertEqual(response.data['currency'], 'SAR')
        # الجلسة سُجلت على الدفعة
        payment = Payment.objects.get(order_id=order_id)
        self.assertEqual(payment.transaction_id, response.data['session_id'])
        self.assertEqual(payment.status, 'pending')

    def test_confirm_with_approved_card(self):
        order_id = self._create_order()
        session = self.client.post(f'/api/orders/{order_id}/pay/').data
        response = self.client.post(f'/api/orders/{order_id}/pay/confirm/', {
            'session_id': session['session_id'],
            'card_number': '4111111111111111',
            'card_expiry': '12/28',
            'card_cvv': '123',
            'card_name': 'عميل الإطلاق',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['payment_status'], 'completed')

        # الدفعة اكتملت والطلب تأكد
        payment = Payment.objects.get(order_id=order_id)
        self.assertEqual(payment.status, 'completed')
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'confirmed')
        self.assertNotIn('4111', payment.notes)  # لا أثر لرقم البطاقة

    def test_confirm_with_declined_card(self):
        order_id = self._create_order()
        session = self.client.post(f'/api/orders/{order_id}/pay/').data
        response = self.client.post(f'/api/orders/{order_id}/pay/confirm/', {
            'session_id': session['session_id'],
            'card_number': '4222222222222222',
            'card_expiry': '12/28', 'card_cvv': '123', 'card_name': 'x',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payment = Payment.objects.get(order_id=order_id)
        self.assertEqual(payment.status, 'failed')
        # الطلب بقي معلقاً ولم يتأثر المخزون
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'pending')

    def test_confirm_rejects_session_mismatch(self):
        """جلسة طلب آخر لا تصلح لتأكيد طلبي (منع إعادة الاستخدام)"""
        order_a = self._create_order()
        order_b = self._create_order()
        session_b = self.client.post(f'/api/orders/{order_b}/pay/').data['session_id']
        response = self.client.post(f'/api/orders/{order_a}/pay/confirm/', {
            'session_id': session_b,
            'card_number': '4111111111111111',
            'card_expiry': '12/28', 'card_cvv': '123', 'card_name': 'x',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Payment.objects.get(order_id=order_a).status, 'pending')

    def test_cannot_pay_others_order(self):
        order_id = self._create_order()
        self.auth_other()
        response = self.client.post(f'/api/orders/{order_id}/pay/')
        # get_queryset يحصر الطلب على صاحبه — غير موجود بالنسبة للآخر
        self.assertIn(response.status_code,
                      (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_double_payment_rejected(self):
        order_id = self._create_order()
        session = self.client.post(f'/api/orders/{order_id}/pay/').data
        first = self.client.post(f'/api/orders/{order_id}/pay/confirm/', {
            'session_id': session['session_id'],
            'card_number': '4111111111111111',
            'card_expiry': '12/28', 'card_cvv': '123', 'card_name': 'x'})
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.post(f'/api/orders/{order_id}/pay/confirm/', {
            'session_id': session['session_id'],
            'card_number': '4111111111111111',
            'card_expiry': '12/28', 'card_cvv': '123', 'card_name': 'x'})
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)


# ============================================================
# 4) الإعدادات العامة /api/config/
# ============================================================
class PublicConfigTests(LaunchBase):
    """✅ P0-5: إعدادات عامة بلا أسرار وتُعلن وضع المحاكاة بصدق"""

    def test_config_endpoint_shape(self):
        response = self.client.get('/api/config/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn('payment', data)
        self.assertIn('simulated', data['payment'])
        self.assertIn('card_enabled', data['payment'])
        self.assertIn('support', data)
        # لا مفاتيح سرية في الرد إطلاقاً
        raw = str(data).lower()
        self.assertNotIn('secret', raw)
        self.assertNotIn('password', raw)
        self.assertNotIn('key', raw)


# ============================================================
# 5) إصلاحات الجودة التشغيلية (P1) — الإصدار v1.2.0
# ============================================================
class OrderNumberRobustnessTests(LaunchBase):
    """✅ P1: توليد أرقام طلبات مقاوم لسباق التنفيذ"""

    def test_numbers_unique_and_well_formed(self):
        numbers = {Order.generate_order_number() for _ in range(50)}
        # 50 رقماً مختلفاً كلياً
        self.assertEqual(len(numbers), 50)
        import re
        for n in numbers:
            self.assertRegex(
                n, r'^TRZ-\d{8}-[0-9A-F]{6}$',
                f'رقم الطلب لا يطابق الصيغة المتينة: {n}')

    def test_number_survives_sequential_prefix_collision(self):
        """الرقم لا يعتمد على عدّ الصفوف — حذف طلب لا يعيد استخدام أرقام"""
        order = Order.objects.create(
            order_number=Order.generate_order_number(),
            customer=self.customer, channel='pos')
        first_number = order.order_number
        order.delete()
        another = Order.generate_order_number()
        self.assertNotEqual(first_number, another)


class CollectedRevenueTests(LaunchBase):
    """✅ P1: فصل الإيراد المحصّل فعلياً عن قيمة الطلبات"""

    def _create_paid_order(self, amount, paid=True):
        order = Order.objects.create(
            order_number=Order.generate_order_number(),
            customer=self.customer, channel='online',
            total_amount=amount, final_amount=amount)
        Payment.objects.create(
            order=order, amount=amount, method='card',
            status='completed' if paid else 'pending')
        return order

    def test_statistics_separate_collected_from_total(self):
        self._create_paid_order(Decimal('100'), paid=True)
        self._create_paid_order(Decimal('50'), paid=False)  # غير محصلة

        self.auth(self.admin_token)
        response = self.client.get('/api/orders/statistics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        # الإجمالي يشمل الطلبين، والمحصّل الأول فقط
        self.assertEqual(Decimal(str(data['total_revenue'])), Decimal('150'))
        self.assertEqual(Decimal(str(data['collected_revenue'])), Decimal('100'))
        self.assertEqual(Decimal(str(data['outstanding_revenue'])), Decimal('50'))

    def test_dashboard_includes_collected_breakdown(self):
        self._create_paid_order(Decimal('300'), paid=True)
        self.auth(self.admin_token)
        response = self.client.get('/api/dashboard/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        revenue = response.data['revenue']
        self.assertIn('collected_total', revenue)
        self.assertIn('collected_month', revenue)
        self.assertIn('outstanding', revenue)
        self.assertGreaterEqual(Decimal(str(revenue['collected_total'])), Decimal('300'))

    def test_dashboard_sales_by_day_covers_30_days(self):
        """السلسلة اليومية مكتملة 30 يوماً ولو لم توجد طلبات"""
        self.auth(self.admin_token)
        response = self.client.get('/api/dashboard/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sales = response.data['sales_by_day']
        self.assertEqual(len(sales), 30)
        # التسلسل الزمني تصاعدي
        dates = [row['date'] for row in sales]
        self.assertEqual(dates, sorted(dates))


class MyOrdersPaginationTests(LaunchBase):
    """✅ P1: ترقيم صفحات طلبات العميل"""

    def test_my_orders_is_paginated(self):
        for _ in range(25):
            Order.objects.create(
                order_number=Order.generate_order_number(),
                customer=self.customer, channel='online')
        self.auth_customer()
        response = self.client.get('/api/orders/my_orders/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn('results', data)
        self.assertIn('count', data)
        self.assertEqual(data['count'], 25)
        # حجم الصفحة الافتراضي 20
        self.assertLessEqual(len(data['results']), 20)
