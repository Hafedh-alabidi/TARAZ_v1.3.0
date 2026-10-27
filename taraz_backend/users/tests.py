"""
اختبارات API شاملة لنظام طراز — للتشغيل: python manage.py test
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from inventory.models import Category, Supplier, Product, Inventory
from orders.models import Order, OrderItem, Payment, Commission

User = get_user_model()


class BaseTestCase(APITestCase):
    """إعداد البيانات المشتركة للاختبارات"""

    def setUp(self):
        # كل الطلبات ترسل JSON (كما تفعل الواجهات الأمامية فعلياً)
        self.client.default_format = 'json'
        # تنظيف عدادات تحديد المعدل بين الاختبارات
        cache.clear()

        self.admin = User.objects.create_user(
            'testadmin', 'admin@test.com', 'Admin@2026',
            role='admin', is_staff=True, is_superuser=True)
        self.manager = User.objects.create_user(
            'testmanager', 'manager@test.com', 'Manager@2026', role='manager')
        self.employee = User.objects.create_user(
            'testemployee', 'employee@test.com', 'Employee@2026', role='employee')
        self.customer = User.objects.create_user(
            'testcustomer', 'customer@test.com', 'Customer@2026', role='customer')

        self.category = Category.objects.create(name='إلكترونيات', icon='electronics')
        self.supplier = Supplier.objects.create(
            name='مورد تجريبي', phone='0551234567', address='الرياض',
            city='الرياض', country='السعودية')
        self.product = Product.objects.create(
            name='منتج اختبار', category=self.category, supplier=self.supplier,
            price=Decimal('100'), cost=Decimal('60'), quantity=50, min_quantity=10,
            sku='TEST-001', barcode='6280000001')

        self.admin_token = Token.objects.create(user=self.admin)
        self.customer_token = Token.objects.create(user=self.customer)
        self.employee_token = Token.objects.create(user=self.employee)

    def auth_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')

    def auth_customer(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.customer_token.key}')

    def auth_employee(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.employee_token.key}')


class SecurityPrivilegeEscalationTests(BaseTestCase):
    """
    ✅ اختبارات الثغرة الحرجة الأولى في تقرير التدقيق:
    منع تصعيد الصلاحيات — العميل لا يستطيع ترقية دوره عبر أي مسار.
    """

    def test_customer_cannot_escalate_role_via_update_me(self):
        """محاولة العميل رفع دوره لمشرف عبر تحديث الملف الشخصي — تُرفض"""
        self.auth_customer()
        response = self.client.patch('/api/users/update_me/', {
            'role': 'admin', 'is_staff': True, 'is_active': True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, 'customer')
        self.assertFalse(self.customer.is_staff)
        self.assertTrue(self.customer.is_active)

    def test_customer_update_me_allows_safe_fields_only(self):
        """تحديث الحقول الآمنة يعمل — والدور لا يتغير"""
        self.auth_customer()
        response = self.client.patch('/api/users/update_me/', {
            'phone': '0551112222', 'city': 'جدة'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.phone, '0551112222')
        self.assertEqual(self.customer.city, 'جدة')
        self.assertEqual(self.customer.role, 'customer')

    def test_customer_cannot_use_admin_users_endpoint(self):
        self.auth_customer()
        response = self.client.patch(
            f'/api/users/{self.customer.id}/', {'role': 'admin'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, 'customer')

    def test_manager_cannot_create_admin_user(self):
        """المدير ينشئ مستخدماً بدور مشرف — يُنشأ عميلاً (الدور للقراءة فقط)"""
        manager_token = Token.objects.create(user=self.manager)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {manager_token.key}')
        response = self.client.post('/api/users/', {
            'username': 'esctest', 'email': 'esc@test.com',
            'role': 'admin', 'is_active': True})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(username='esctest')
        self.assertEqual(created.role, 'customer')

    def test_manager_cannot_promote_self_to_admin(self):
        manager_token = Token.objects.create(user=self.manager)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {manager_token.key}')
        response = self.client.patch(
            f'/api/users/{self.manager.id}/', {'role': 'admin'})
        self.manager.refresh_from_db()
        self.assertEqual(self.manager.role, 'manager')

    def test_admin_can_assign_role(self):
        """المشرف فعلاً يملك تعيين الدور — عبر مسلسل الإدارة الخاص به"""
        self.auth_admin()
        response = self.client.patch(
            f'/api/users/{self.customer.id}/', {'role': 'employee'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.role, 'employee')

    def test_change_password_revokes_all_tokens(self):
        """تغيير كلمة المرور يبطل كل الجلسات القديمة ويصدر رمزاً جديداً"""
        self.auth_customer()
        old_key = self.customer_token.key
        response = self.client.post('/api/users/change_password/', {
            'old_password': 'Customer@2026',
            'new_password': 'NewStrong@Pass9'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)
        new_key = response.data['token']
        self.assertNotEqual(new_key, old_key)
        # الرمز القديم لم يعد صالحاً
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {old_key}')
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        # الرمز الجديد يعمل
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {new_key}')
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_expired_token_rejected_and_deleted(self):
        """رمز انتهت صلاحيته يُرفض ويُحذف"""
        token = self.customer_token
        # تقديم تاريخ الإنشاء إلى الماضي (أقدم من مدة الصلاحية 30 يوماً)
        Token.objects.filter(pk=token.pk).update(
            created=timezone.now() - timedelta(days=31))
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(Token.objects.filter(pk=token.pk).exists())

    def test_login_attempts_throttled(self):
        """أكثر من 10 محاولات دخول فاشلة في الدقيقة → 429"""
        cache.clear()
        for i in range(10):
            self.client.post('/api/auth/login/', {
                'username': 'testadmin', 'password': f'wrong-{i}'})
        response = self.client.post('/api/auth/login/', {
            'username': 'testadmin', 'password': 'wrong-again'})
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class HealthCheckTests(APITestCase):
    def setUp(self):
        self.client.default_format = 'json'
        cache.clear()

    def test_health_endpoint_minimal(self):
        """فحص الصحة لا يكشف تفاصيل قاعدة البيانات أو الإصدارات"""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')
        # لا تفاصيل بنية تحتية للعامة
        self.assertNotIn('database', response.data)
        self.assertNotIn('version', response.data)


class AuthTests(BaseTestCase):
    def test_login_success(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'testadmin', 'password': 'Admin@2026'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)
        self.assertEqual(response.data['user']['role'], 'admin')

    def test_login_wrong_password(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'testadmin', 'password': 'wrong'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_customer(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'newuser', 'email': 'new@test.com',
            'password': 'Strong@Pass1', 'password2': 'Strong@Pass1',
            'first_name': 'مستخدم', 'last_name': 'جديد'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['role'], 'customer')
        self.assertIn('token', response.data)

    def test_register_password_mismatch(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'newuser2', 'email': 'new2@test.com',
            'password': 'Strong@Pass1', 'password2': 'Different@Pass'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_requires_auth(self):
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_with_token(self):
        self.auth_customer()
        response = self.client.get('/api/users/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testcustomer')


class ProductTests(BaseTestCase):
    def test_public_can_list_products(self):
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_cannot_create_product(self):
        response = self.client.post('/api/products/', {
            'name': 'x', 'category': self.category.id, 'price': 10, 'sku': 'X1'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_cannot_create_product(self):
        self.auth_customer()
        response = self.client.post('/api/products/', {
            'name': 'x', 'category': self.category.id, 'price': 10, 'sku': 'X2'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_product(self):
        self.auth_admin()
        response = self.client.post('/api/products/', {
            'name': 'منتج جديد', 'category': self.category.id,
            'price': 200, 'cost': 120, 'quantity': 30, 'min_quantity': 5,
            'sku': 'NEW-001'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Product.objects.filter(sku='NEW-001').exists())
        # سجل المخزون يُنشأ تلقائياً
        product = Product.objects.get(sku='NEW-001')
        self.assertTrue(Inventory.objects.filter(product=product).exists())

    def test_duplicate_sku_rejected(self):
        self.auth_admin()
        response = self.client.post('/api/products/', {
            'name': 'مكرر', 'category': self.category.id, 'price': 10,
            'sku': 'TEST-001'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_low_stock_endpoint(self):
        self.auth_employee()
        response = self.client.get('/api/products/low_stock/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_quantity_delta(self):
        self.auth_employee()
        response = self.client.post(
            f'/api/products/{self.product.id}/update_quantity/', {'delta': -5})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 45)


class OrderTests(BaseTestCase):
    def test_create_order_decrements_stock(self):
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 3}],
            'payment_method': 'card',
            'shipping_name': 'اسم العميل', 'shipping_phone': '0550000000',
            'shipping_address': 'عنوان تجريبي', 'shipping_city': 'الرياض'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 47)  # 50 - 3

        order = Order.objects.get(order_number=response.data['order_number'])
        # الضريبة العامة على المبيعات (اليمن) 5%
        expected_tax = (Decimal('300') * Decimal('0.05')).quantize(Decimal('0.01'))
        self.assertEqual(order.tax, expected_tax)
        # دفعة وعمولة تلقائية
        self.assertTrue(Payment.objects.filter(order=order).exists())
        self.assertTrue(Commission.objects.filter(order=order).exists())

    def test_create_order_insufficient_stock(self):
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 500}]})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # المخزون لم يتأثر
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 50)

    def test_customer_sees_only_own_orders(self):
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 1}]})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.get('/api/orders/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for order in response.data['results']:
            self.assertEqual(order['customer'], self.customer.id)

    def test_order_status_flow(self):
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 2}]})
        order_id = response.data['id']

        # الموظف يؤكد ثم يشحن ثم يسلم
        self.auth_employee()
        response = self.client.post(f'/api/orders/{order_id}/confirm/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.post(f'/api/orders/{order_id}/ship/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.post(f'/api/orders/{order_id}/deliver/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # التسليم نهائي — لا يمكن الشحن بعد التسليم
        response = self.client.post(f'/api/orders/{order_id}/ship/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_order_restores_stock(self):
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 5}]})
        order_id = response.data['id']
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 45)

        # العميل يلغي طلبه المعلق
        response = self.client.post(f'/api/orders/{order_id}/cancel/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 50)  # استرجعت الكمية

    def test_statistics_staff_only(self):
        self.auth_customer()
        response = self.client.get('/api/orders/statistics/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.auth_employee()
        response = self.client.get('/api/orders/statistics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_revenue', response.data)


class DashboardTests(BaseTestCase):
    def test_dashboard_stats_staff_only(self):
        self.auth_customer()
        response = self.client.get('/api/dashboard/stats/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_stats_content(self):
        self.auth_admin()
        # إنشاء طلب حتى تكون هناك بيانات
        self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 2}]})
        response = self.client.get('/api/dashboard/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('revenue', response.data)
        self.assertIn('sales_by_day', response.data)
        self.assertEqual(len(response.data['sales_by_day']), 30)
        self.assertIn('top_products', response.data)
        self.assertIn('recent_orders', response.data)


class PaymentTests(BaseTestCase):
    def test_payment_complete_flow(self):
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 1}],
            'payment_method': 'cod'})  # دفع عند الاستلام → pending
        order_id = response.data['id']
        payment_id = response.data['payment']['id']
        self.assertEqual(response.data['payment']['status'], 'pending')

        # الموظف يكمل الدفع
        self.auth_employee()
        response = self.client.post(f'/api/payments/{payment_id}/complete/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'completed')

        # الطلب تأكد تلقائياً
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'confirmed')


class PermissionTests(BaseTestCase):
    def test_users_list_staff_only(self):
        self.auth_customer()
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.auth_admin()
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_customer_cannot_delete_product(self):
        self.auth_customer()
        response = self.client.delete(f'/api/products/{self.product.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_commissions_admin_only(self):
        self.auth_employee()
        response = self.client.get('/api/commissions/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.auth_admin()
        response = self.client.get('/api/commissions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ============================================================
# ✅ اختبارات استعادة كلمة المرور (P0)
# ============================================================
from django.core import mail
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
import re


class PasswordResetTests(BaseTestCase):
    """مسار استعادة كلمة المرور: طلب الرابط ثم التعيين والإبطال"""

    def _request_reset(self, email):
        return self.client.post('/api/auth/password-reset/', {'email': email})

    def test_request_sends_email_with_link(self):
        response = self._request_reset('customer@test.com')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # رسالة واحدة أُرسلت للبريد الصحيح
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('customer@test.com', mail.outbox[0].to)
        # الرابط موجود في المتن
        body = mail.outbox[0].body
        self.assertIn('/reset-password?uid=', body)
        self.assertIn('&token=', body)

    def test_request_unknown_email_no_enumeration(self):
        """لا يُكشف وجود البريد — نفس الرد تماماً وبلا أي رسالة"""
        response = self._request_reset('ghost@nowhere.com')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)
        # نفس رسالة النجاح العامة (لا فرق في الرد)
        self.assertIn('detail', response.data)

    def _extract_token_pair(self):
        self._request_reset('customer@test.com')
        body = mail.outbox[0].body
        match = re.search(r'uid=([^&\s]+)&token=([^\s]+)', body)
        self.assertIsNotNone(match, 'رابط الاستعادة غير موجود في البريد')
        return match.group(1), match.group(2)

    def test_confirm_resets_password_and_invalidates_tokens(self):
        uid, token = self._extract_token_pair()
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': uid, 'token': token,
            'new_password': 'NewSecure@2026', 'new_password2': 'NewSecure@2026'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # كلمة المرور الجديدة تعمل
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.check_password('NewSecure@2026'))
        # الرموز القديمة أُبطلت
        self.assertEqual(Token.objects.filter(user=self.customer).count(), 0)
        # الدخول بالجديدة ينجح
        response = self.client.post('/api/auth/login/', {
            'username': 'testcustomer', 'password': 'NewSecure@2026'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_confirm_token_single_use(self):
        """الرمز يعمل مرة واحدة فقط"""
        uid, token = self._extract_token_pair()
        payload = {'uid': uid, 'token': token,
                   'new_password': 'NewSecure@2026', 'new_password2': 'NewSecure@2026'}
        first = self.client.post('/api/auth/password-reset/confirm/', payload)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.post('/api/auth/password-reset/confirm/', payload)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_invalid_token_rejected(self):
        uid, _ = self._extract_token_pair()
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': uid, 'token': 'totally-invalid-token',
            'new_password': 'NewSecure@2026', 'new_password2': 'NewSecure@2026'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_weak_password_rejected(self):
        uid, token = self._extract_token_pair()
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': uid, 'token': token,
            'new_password': '123', 'new_password2': '123'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
