"""
✅ اختبارات أمن دورة البيع المالية — الثغرة الحرجة الثانية في تقرير التدقيق:
منع تجاوز الدفع والخصومات وقناة نقطة البيع، ومنع تجاوز المخزون عبر
تكرار المنتج نفسه في عدة أسطر، وحماية انتقالات حالة الطلب.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from inventory.models import Category, Supplier, Product, Inventory
from orders.models import Order, OrderItem, Payment

User = get_user_model()


class OrderSecurityBase(APITestCase):
    """إعداد بيانات اختبارات أمن الطلبات"""

    def setUp(self):
        self.client.default_format = 'json'
        cache.clear()

        self.admin = User.objects.create_user(
            'secadmin', 'admin@test.com', 'Admin@2026',
            role='admin', is_staff=True, is_superuser=True)
        self.employee = User.objects.create_user(
            'secemployee', 'emp@test.com', 'Employee@2026', role='employee')
        self.customer = User.objects.create_user(
            'seccustomer', 'cust@test.com', 'Customer@2026', role='customer')

        self.category = Category.objects.create(name='إلكترونيات', icon='electronics')
        self.supplier = Supplier.objects.create(
            name='مورد تجريبي', phone='0551234567', address='الرياض',
            city='الرياض', country='السعودية')
        self.product = Product.objects.create(
            name='منتج اختبار أمني', category=self.category, supplier=self.supplier,
            price=Decimal('100'), cost=Decimal('60'), quantity=50, min_quantity=10,
            sku='SEC-001', barcode='6280000099')
        Inventory.objects.create(product=self.product, quantity_in_stock=50)

        self.customer_token = Token.objects.create(user=self.customer)
        self.employee_token = Token.objects.create(user=self.employee)
        self.admin_token = Token.objects.create(user=self.admin)

    def auth_customer(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.customer_token.key}')

    def auth_employee(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.employee_token.key}')

    def auth_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')

    def stock(self):
        self.product.refresh_from_db()
        inv = Inventory.objects.get(product=self.product)
        return self.product.quantity, inv.quantity_in_stock


class ChannelAndDiscountSecurityTests(OrderSecurityBase):
    """قناة نقطة البيع والخصم — صلاحيات موظفين حصراً"""

    def test_customer_cannot_create_pos_order(self):
        """العميل يرسل channel=pos ليصنع طلباً مكتمل التسليم والدفع — مرفوض 403"""
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 2}],
            'channel': 'pos', 'payment_method': 'cash'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(self.stock(), (50, 50))  # المخزون لم يُمس

    def test_customer_cannot_apply_discount(self):
        """العميل يرسل خصماً بنفسه — مرفوض ولا يُنشأ الطلب"""
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 2}],
            'discount': 200})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(self.stock(), (50, 50))

    def test_staff_discount_within_cap_applied(self):
        """موظف يطبق خصماً ضمن السقف (50%) — يعمل ويُحسب صح"""
        self.auth_employee()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 3}],  # 300
            'channel': 'pos', 'payment_method': 'cash', 'discount': 30})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(order_number=response.data['order_number'])
        self.assertEqual(order.discount, Decimal('30'))
        # 300 - 30 = 270 → ضريبة 5% (13.50) → 283.50 (بلا شحن لنقطة البيع)
        self.assertEqual(order.final_amount, Decimal('283.50'))

    def test_staff_discount_above_cap_rejected(self):
        """خصم يتجاوز سقف 50% من قيمة الطلب — مرفوض"""
        self.auth_employee()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 3}],
            'channel': 'pos', 'payment_method': 'cash', 'discount': 200})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(self.stock(), (50, 50))

    def test_customer_full_discount_exploit_blocked(self):
        """سيناريو الثغرة الأصلي: خصم بقيمة الطلب كاملة — محجوب"""
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 5}],
            'discount': 500, 'payment_method': 'card',
            'shipping_address': 'عنوان تجريبي'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Order.objects.count(), 0)


class OnlinePaymentIntegrityTests(OrderSecurityBase):
    """دفعات المتجر لا تُسجل مكتملة عند الإنشاء مهما كانت الطريقة"""

    def _create_online(self, method):
        self.auth_customer()
        return self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 1}],
            'payment_method': method,
            'shipping_name': 'عميل', 'shipping_phone': '0550000000',
            'shipping_address': 'عنوان تجريبي', 'shipping_city': 'الرياض'})

    def test_card_payment_pending_not_completed(self):
        """بطاقة أونلاين بلا بوابة دفع → قيد الانتظار (كانت تُسجل مكتملة)"""
        response = self._create_online('card')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['payment']['status'], 'pending')
        self.assertEqual(response.data['status'], 'pending')

    def test_card_payment_has_no_fake_transaction_id(self):
        """لا معرف معاملة مُختلق لبوابة دفع غير موجودة"""
        response = self._create_online('card')
        self.assertEqual(response.data['payment']['transaction_id'], '')

    def test_cash_online_payment_pending(self):
        response = self._create_online('cash')
        self.assertEqual(response.data['payment']['status'], 'pending')

    def test_transfer_online_payment_pending(self):
        response = self._create_online('transfer')
        self.assertEqual(response.data['payment']['status'], 'pending')

    def test_staff_can_complete_payment_after_verification(self):
        """الموظف يكمل الدفع بعد تحقق التحصيل الفعلي — الطلب يؤكد تلقائياً"""
        response = self._create_online('transfer')
        payment_id = response.data['payment']['id']
        order_id = response.data['id']
        self.auth_employee()
        response = self.client.post(f'/api/payments/{payment_id}/complete/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'completed')
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'confirmed')


class StockBypassSecurityTests(OrderSecurityBase):
    """منع تجاوز المخزون بتكرار المنتج نفسه في عدة أسطر"""

    def test_duplicate_product_lines_aggregated(self):
        """المتاح 5 والطلب سطران × 4 من نفس المنتج — يُرفض الإجمالي 8"""
        Product.objects.filter(pk=self.product.pk).update(quantity=5)
        Inventory.objects.filter(product=self.product).update(quantity_in_stock=5)
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [
                {'product_id': self.product.id, 'quantity': 4},
                {'product_id': self.product.id, 'quantity': 4},
            ]})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(self.stock(), (5, 5))

    def test_merged_lines_become_single_item(self):
        """الأسطر المكررة تُدمج في عنصر واحد بالكمية الإجمالية"""
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [
                {'product_id': self.product.id, 'quantity': 2},
                {'product_id': self.product.id, 'quantity': 3},
            ]})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(order_number=response.data['order_number'])
        items = order.items.all()
        self.assertEqual(items.count(), 1)
        self.assertEqual(items[0].quantity, 5)
        self.assertEqual(self.stock(), (45, 45))

    def test_service_layer_prevents_oversell(self):
        """حارس الخدمة: أي خصم يجعل الكمية سالبة يُرفض (حماية السباق المتزامن)"""
        from inventory.services import apply_stock_change
        with self.assertRaises(ValueError):
            apply_stock_change(
                product_id=self.product.pk, delta=-51,
                movement_type='out', reference='RACE-TEST')


class OrderStatusSecurityTests(OrderSecurityBase):
    """انتقالات حالة الطلب — موظفون فقط"""

    def _create_pending_order(self):
        self.auth_customer()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 1}]})
        return response.data['id']

    def test_customer_cannot_confirm_own_order(self):
        order_id = self._create_pending_order()
        self.auth_customer()
        response = self.client.post(f'/api/orders/{order_id}/confirm/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_deliver_own_order(self):
        order_id = self._create_pending_order()
        self.auth_customer()
        response = self.client.post(f'/api/orders/{order_id}/deliver/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'pending')

    def test_employee_can_manage_status(self):
        order_id = self._create_pending_order()
        self.auth_employee()
        response = self.client.post(f'/api/orders/{order_id}/confirm/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.post(f'/api/orders/{order_id}/ship/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.post(f'/api/orders/{order_id}/deliver/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'delivered')


class CancelRefundIntegrityTests(OrderSecurityBase):
    """الإلغاء والاسترجاع يضيفان المخزون مرة واحدة فقط — لا تكرار"""

    def _create_order(self, channel=None):
        self.auth_customer()
        payload = {'items': [{'product_id': self.product.id, 'quantity': 5}]}
        if channel:
            payload['channel'] = channel
        response = self.client.post('/api/orders/', payload)
        return response.data['id']

    def test_cancel_twice_restores_stock_once(self):
        order_id = self._create_order()
        self.assertEqual(self.stock(), (45, 45))
        # إلغاء أول — إرجاع الكمية
        response = self.client.post(f'/api/orders/{order_id}/cancel/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.stock(), (50, 50))
        # إلغاء ثانٍ — مرفوض ولا إرجاع إضافي
        response = self.client.post(f'/api/orders/{order_id}/cancel/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.stock(), (50, 50))

    def test_refund_restores_stock_once(self):
        # طلب نقطة بيع مكتمل الدفع (موظف)
        self.auth_employee()
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 5}],
            'channel': 'pos', 'payment_method': 'cash'})
        payment_id = response.data['payment']['id']
        order_id = response.data['id']
        self.assertEqual(self.stock(), (45, 45))

        # استرجاع أول — إلغاء + إرجاع المخزون
        response = self.client.post(f'/api/payments/{payment_id}/refund/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.stock(), (50, 50))

        # استرجاع ثانٍ — مرفوض (الدفعة مسترجعة أصلاً) ولا إرجاع إضافي
        response = self.client.post(f'/api/payments/{payment_id}/refund/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.stock(), (50, 50))
