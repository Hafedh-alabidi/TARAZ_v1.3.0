"""
اختبارات مزامنة المخزون وسجل الحركات (StockMovement) — نقطة تدقيق أساسية:
كل تغيير على كمية منتج يجب أن يحدّث Product.quantity و Inventory.quantity_in_stock
معاً ويسجّل حركة قابلة للتتبع.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from inventory.models import Category, Supplier, Product, Inventory, StockMovement
from orders.models import Order
from inventory.services import apply_stock_change, sync_all_inventory

User = get_user_model()


class StockSyncBaseTestCase(APITestCase):
    """إعداد البيانات المشتركة"""

    def setUp(self):
        self.client.default_format = 'json'
        cache.clear()
        self.admin = User.objects.create_user(
            'syncadmin', 'admin@test.com', 'Admin@2026',
            role='admin', is_staff=True, is_superuser=True)
        self.employee = User.objects.create_user(
            'syncemployee', 'emp@test.com', 'Employee@2026', role='employee')
        self.customer = User.objects.create_user(
            'synccustomer', 'cust@test.com', 'Customer@2026', role='customer')

        self.category = Category.objects.create(name='إلكترونيات', icon='electronics')
        self.supplier = Supplier.objects.create(
            name='مورد تجريبي', phone='0551234567', address='الرياض',
            city='الرياض', country='السعودية')
        self.product = Product.objects.create(
            name='منتج اختبار', category=self.category, supplier=self.supplier,
            price=Decimal('100'), cost=Decimal('60'), quantity=50, min_quantity=10,
            sku='SYNC-001', barcode='6280000001')
        Inventory.objects.create(product=self.product, quantity_in_stock=50)

        self.admin_token = Token.objects.create(user=self.admin)
        self.employee_token = Token.objects.create(user=self.employee)
        self.customer_token = Token.objects.create(user=self.customer)

    def auth(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def assert_stock_consistent(self, product, expected):
        """التحقق من تطابق المصدرين: المنتج وسجل المخزون"""
        product.refresh_from_db()
        inv = Inventory.objects.get(product=product)
        self.assertEqual(product.quantity, expected)
        self.assertEqual(inv.quantity_in_stock, expected)


class StockServiceTests(StockSyncBaseTestCase):
    """اختبارات خدمة apply_stock_change مباشرة"""

    def test_sale_decrements_both_and_records_movement(self):
        apply_stock_change(
            product_id=self.product.pk, delta=-3, movement_type='out',
            reference='TRZ-TEST-0001', notes='بيع تجريبي', user=self.admin)
        self.assert_stock_consistent(self.product, 47)
        mv = StockMovement.objects.get(reference='TRZ-TEST-0001')
        self.assertEqual(mv.quantity, -3)
        self.assertEqual(mv.stock_after, 47)
        self.assertEqual(mv.movement_type, 'out')
        self.assertEqual(mv.created_by, self.admin)

    def test_restock_increments_and_sets_restock_date(self):
        apply_stock_change(product_id=self.product.pk, delta=20, movement_type='in',
                           reference='RESTOCK-1', user=self.employee)
        self.assert_stock_consistent(self.product, 70)
        inv = Inventory.objects.get(product=self.product)
        self.assertIsNotNone(inv.last_restock_date)

    def test_negative_stock_rejected(self):
        with self.assertRaises(ValueError):
            apply_stock_change(product_id=self.product.pk, delta=-60, movement_type='out')

    def test_creates_inventory_record_if_missing(self):
        product2 = Product.objects.create(
            name='منتج بلا سجل', category=self.category,
            price=Decimal('50'), quantity=10, sku='SYNC-002')
        apply_stock_change(product_id=product2.pk, delta=-2, movement_type='out')
        self.assert_stock_consistent(product2, 8)

    def test_sync_all_inventory(self):
        # فك المزامنة عمداً ثم أعد المزامنة
        Inventory.objects.filter(product=self.product).update(quantity_in_stock=999)
        sync_all_inventory()
        self.assert_stock_consistent(self.product, 50)


class OrderStockSyncTests(StockSyncBaseTestCase):
    """إنشاء/إلغاء الطلبات عبر API يجب أن يزامن المخزون ويسجل الحركات"""

    def _create_order(self, channel=None, payment='cash'):
        payload = {
            'items': [{'product_id': self.product.pk, 'quantity': 5}],
            'payment_method': payment,
        }
        if channel:
            payload['channel'] = channel
        return self.client.post('/api/orders/', payload)

    def test_online_order_syncs_inventory_and_records_movement(self):
        self.auth(self.customer_token)
        response = self._create_order(channel='online', payment='cod')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assert_stock_consistent(self.product, 45)

        order_number = response.data['order_number']
        mv = StockMovement.objects.get(reference=order_number)
        self.assertEqual(mv.quantity, -5)
        self.assertEqual(mv.movement_type, 'out')
        # الطلب عبر المتجر يبدأ قيد الانتظار
        self.assertEqual(response.data['status'], 'pending')

    def test_cancel_order_restores_stock_with_return_movement(self):
        self.auth(self.customer_token)
        response = self._create_order(channel='online', payment='cod')
        order_number = response.data['order_number']
        self.assert_stock_consistent(self.product, 45)

        cancel = self.client.post(f"/api/orders/{response.data['id']}/cancel/")
        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        self.assert_stock_consistent(self.product, 50)

        mv = StockMovement.objects.get(reference=order_number, movement_type='return')
        self.assertEqual(mv.quantity, +5)
        self.assertEqual(mv.stock_after, 50)

    def test_pos_order_created_delivered_with_completed_payment(self):
        """بيع نقطة البيع: طلب مكتمل التسليم فوراً + دفعة مكتملة + عمولة"""
        self.auth(self.employee_token)
        response = self._create_order(channel='pos', payment='cash')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'delivered')
        self.assertEqual(response.data['channel'], 'pos')
        self.assertEqual(response.data['payment']['status'], 'completed')
        self.assert_stock_consistent(self.product, 45)

        mv = StockMovement.objects.get(reference=response.data['order_number'])
        self.assertEqual(mv.movement_type, 'out')
        self.assertIn('نقطة بيع', mv.notes)

    def test_pos_card_payment_also_completed(self):
        self.auth(self.employee_token)
        response = self._create_order(channel='pos', payment='card')
        self.assertEqual(response.data['payment']['status'], 'completed')
        self.assertEqual(response.data['payment']['method'], 'card')

    def test_online_cod_payment_stays_pending(self):
        self.auth(self.customer_token)
        response = self._create_order(channel='online', payment='cod')
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(response.data['payment']['status'], 'pending')

    def test_pos_orders_counted_in_top_products(self):
        """مبيعات POS تظهر في أفضل المنتجات (كانت مفقودة سابقاً)"""
        from orders.views import DashboardStatsView  # noqa: F401 — للتأكد من الاستيراد
        self.auth(self.employee_token)
        self._create_order(channel='pos', payment='cash')
        self.auth(self.admin_token)
        stats = self.client.get('/api/dashboard/stats/')
        top_names = [p['name'] for p in stats.data['top_products']]
        self.assertIn('منتج اختبار', top_names)


class StockMovementAPITests(StockSyncBaseTestCase):
    """endpoint سجل الحركات + الصلاحيات"""

    def test_movements_requires_staff(self):
        self.auth(self.customer_token)
        response = self.client.get('/api/stock-movements/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_movements_list_for_staff(self):
        self.auth(self.employee_token)
        self.client.post('/api/products/1/update_quantity/', {'delta': -5})
        response = self.client.get('/api/stock-movements/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data['count'], 1)
        mv = response.data['results'][0]
        self.assertIn('movement_type_display', mv)
        self.assertIn('product_name', mv)
        self.assertIn('stock_after', mv)

    def test_product_history_endpoint(self):
        self.auth(self.employee_token)
        self.client.post('/api/products/1/update_quantity/', {'delta': -5})
        self.client.post('/api/products/1/restock/', {'amount': 10})
        response = self.client.get('/api/stock-movements/product_history/?product_id=1')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        # الأحدث أولاً: إدخال ثم تسوية
        self.assertEqual(response.data[0]['movement_type'], 'in')
        self.assertEqual(response.data[1]['movement_type'], 'adjustment')

    def test_update_quantity_syncs_inventory(self):
        self.auth(self.employee_token)
        response = self.client.post('/api/products/1/update_quantity/', {'quantity': 42})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assert_stock_consistent(self.product, 42)
        mv = StockMovement.objects.filter(movement_type='adjustment').latest('created_at')
        self.assertEqual(mv.quantity, -8)  # من 50 إلى 42
        self.assertEqual(mv.stock_after, 42)

    def test_update_quantity_rejects_negative(self):
        self.auth(self.employee_token)
        response = self.client.post('/api/products/1/update_quantity/', {'delta': -55})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assert_stock_consistent(self.product, 50)

    def test_restock_syncs_inventory(self):
        self.auth(self.employee_token)
        response = self.client.post('/api/products/1/restock/', {'amount': 25})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assert_stock_consistent(self.product, 75)
        mv = StockMovement.objects.filter(movement_type='in').latest('created_at')
        self.assertEqual(mv.quantity, 25)
        self.assertEqual(mv.stock_after, 75)

    def test_inventory_sync_admin_only(self):
        self.auth(self.employee_token)
        response = self.client.post('/api/inventory/sync/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.auth(self.admin_token)
        response = self.client.post('/api/inventory/sync/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['records'], Inventory.objects.count())


class ProductDataPrivacyTests(StockSyncBaseTestCase):
    """
    ✅ اختبارات منع تسريب البيانات التجارية — من تقرير التدقيق:
    التكلفة وهامش الربح والكميات الداخلية وبيانات المورد والباركود
    لا تظهر للزوار أو العملاء في أي مسار عام.
    """
    FORBIDDEN_PUBLIC_FIELDS = (
        'cost', 'profit_margin', 'quantity', 'min_quantity',
        'supplier', 'supplier_name', 'barcode',
    )

    def test_anonymous_list_excludes_business_fields(self):
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        fields = set(response.data['results'][0].keys())
        for forbidden in self.FORBIDDEN_PUBLIC_FIELDS:
            self.assertNotIn(forbidden, fields,
                             f'حقل {forbidden} يسريب للعامة!')
        for allowed in ('in_stock', 'availability', 'price', 'name'):
            self.assertIn(allowed, fields)

    def test_anonymous_retrieve_excludes_business_fields(self):
        response = self.client.get(f'/api/products/{self.product.pk}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        fields = set(response.data.keys())
        for forbidden in self.FORBIDDEN_PUBLIC_FIELDS:
            self.assertNotIn(forbidden, fields)

    def test_customer_list_excludes_business_fields(self):
        self.auth(self.customer_token)
        response = self.client.get('/api/products/')
        fields = set(response.data['results'][0].keys())
        for forbidden in self.FORBIDDEN_PUBLIC_FIELDS:
            self.assertNotIn(forbidden, fields)

    def test_staff_list_includes_business_fields(self):
        self.auth(self.employee_token)
        response = self.client.get('/api/products/')
        fields = set(response.data['results'][0].keys())
        self.assertIn('cost', fields)
        self.assertIn('quantity', fields)
        self.assertIn('supplier_name', fields)

    def test_availability_values_correct(self):
        # المنتج الأساسي: 50 وحدة والحد الأدنى 10 → متوفر
        response = self.client.get(f'/api/products/{self.product.pk}/')
        self.assertEqual(response.data['availability'], 'in_stock')
        # منتج على حد الانخفاض: 8 وحدات والحد الأدنى 15 → كمية محدودة
        low = Product.objects.create(
            name='منتج شبه منتهٍ', category=self.category,
            price=Decimal('50'), quantity=8, min_quantity=15, sku='LOW-001')
        response = self.client.get(f'/api/products/{low.pk}/')
        self.assertEqual(response.data['availability'], 'low_stock')
        self.assertTrue(response.data['in_stock'])
        # منتج منتهٍ
        out = Product.objects.create(
            name='منتج منتهٍ', category=self.category,
            price=Decimal('50'), quantity=0, min_quantity=5, sku='OUT-001')
        response = self.client.get(f'/api/products/{out.pk}/')
        self.assertEqual(response.data['availability'], 'out_of_stock')
        self.assertFalse(response.data['in_stock'])

    def test_anonymous_sees_active_products_only(self):
        Product.objects.create(
            name='منتج معطل داخلي', category=self.category,
            price=Decimal('50'), quantity=10, sku='INACT-001', is_active=False)
        response = self.client.get('/api/products/')
        skus = [p['sku'] for p in response.data['results']]
        self.assertNotIn('INACT-001', skus)
        self.assertIn('SYNC-001', skus)

    def test_anonymous_cannot_use_pos_search(self):
        """بحث الباركود/SKU الكامل — لموظفي نقطة البيع فقط"""
        response = self.client.get('/api/products/search/', {'q': '6280000001'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_use_pos_search(self):
        self.auth(self.customer_token)
        response = self.client.get('/api/products/search/', {'q': '6280000001'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_employee_can_use_pos_search(self):
        self.auth(self.employee_token)
        response = self.client.get('/api/products/search/', {'q': '6280000001'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertIn('cost', response.data[0])  # الموظف يرى كل شيء

    def test_anonymous_cannot_list_suppliers(self):
        response = self.client.get('/api/suppliers/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_cannot_list_suppliers(self):
        self.auth(self.customer_token)
        response = self.client.get('/api/suppliers/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_employee_can_list_suppliers(self):
        self.auth(self.employee_token)
        response = self.client.get('/api/suppliers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_customer_cannot_see_low_stock_or_out_of_stock(self):
        self.auth(self.customer_token)
        response = self.client.get('/api/products/low_stock/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.get('/api/products/out_of_stock/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_category_products_public_serializer(self):
        response = self.client.get(f'/api/categories/{self.category.pk}/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        products = (response.data['results']
                    if isinstance(response.data, dict) and 'results' in response.data
                    else response.data)
        if products:
            fields = set(products[0].keys())
            for forbidden in self.FORBIDDEN_PUBLIC_FIELDS:
                self.assertNotIn(forbidden, fields)


# ============================================================
# ✅ رفع صور المنتجات (P1) — v1.2.0
# ============================================================
class ProductImageUploadTests(StockSyncBaseTestCase):
    """رفع صورة منتج مباشرة: صلاحيات، تحقق من النوع والحجم، واستبدال الصور"""

    def setUp(self):
        super().setUp()
        from django.core.files.uploadedfile import SimpleUploadedFile
        from io import BytesIO
        from PIL import Image

        buffer = BytesIO()
        Image.new('RGB', (40, 40), color=(16, 100, 80)).save(buffer, format='PNG')
        buffer.seek(0)
        self.valid_png = SimpleUploadedFile(
            'product.png', buffer.read(), content_type='image/png')

    def _product(self):
        product = Product.objects.create(
            name='منتج رفع الصور', category=self.category,
            price=Decimal('75'), cost=Decimal('30'), quantity=20,
            sku='IMG-001')
        return product

    def test_staff_can_upload_image(self):
        product = self._product()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        response = self.client.post(
            f'/api/products/{product.id}/upload-image/',
            {'image': self.valid_png}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('image_url', response.data)
        product.refresh_from_db()
        self.assertTrue(product.image_file)
        # الصورة الفعلية في المسلسل العام هي الملف المرفوع
        self.assertIn('/media/products/', product.image_url)

    def test_customer_cannot_upload_image(self):
        product = self._product()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.customer_token.key}')
        response = self.client.post(
            f'/api/products/{product.id}/upload-image/',
            {'image': self.valid_png}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_upload_requires_image_field(self):
        product = self._product()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        response = self.client.post(
            f'/api/products/{product.id}/upload-image/', {}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_rejects_non_image(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        product = self._product()
        fake = SimpleUploadedFile(
            'notes.txt', b'not an image', content_type='text/plain')
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        response = self.client.post(
            f'/api/products/{product.id}/upload-image/',
            {'image': fake}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_public_serializer_serves_uploaded_image(self):
        product = self._product()
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        response = self.client.post(
            f'/api/products/{product.id}/upload-image/',
            {'image': self.valid_png}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # زائر بلا مصادقة يرى الصورة المرفوعة في المسلسل العام
        self.client.credentials()
        detail = self.client.get(f'/api/products/{product.id}/')
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertIn('/media/products/', detail.data['image_url'])


class ProductDiscountTests(StockSyncBaseTestCase):
    """سعر ما قبل الخصم ونسبة الخصم وفلتر العروض — صدق العرض التجاري"""

    def _discounted(self):
        product = Product.objects.create(
            name='منتج مخفض', category=self.category,
            price=Decimal('80'), compare_at_price=Decimal('100'),
            quantity=15, sku='SALE-001')
        return product

    def test_discount_percent_calculated_correctly(self):
        product = self._discounted()
        self.assertEqual(product.discount_percent, 20)

    def test_no_discount_when_compare_at_invalid(self):
        # سعر قبل الخصم أقل أو يساوي السعر الحالي = لا خصم (منع التضليل)
        product = Product.objects.create(
            name='منتج بلا خصم', category=self.category,
            price=Decimal('100'), compare_at_price=Decimal('90'),
            quantity=15, sku='SALE-002')
        self.assertIsNone(product.discount_percent)

    def test_public_serializer_exposes_discount_fields(self):
        product = self._discounted()
        response = self.client.get(f'/api/products/{product.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['discount_percent'], 20)
        self.assertEqual(response.data['compare_at_price'], '100.00')

    def test_on_sale_filter_returns_only_discounted(self):
        self._discounted()
        response = self.client.get('/api/products/?on_sale=1')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [p['name'] for p in response.data['results']]
        self.assertIn('منتج مخفض', names)
        self.assertNotIn('منتج اختبار', names)


class ProductGalleryTests(StockSyncBaseTestCase):
    """معرض صور المنتج: رفع بصلاحيات، وعرض في المسلسل العام"""

    def setUp(self):
        super().setUp()
        from django.core.files.uploadedfile import SimpleUploadedFile
        from io import BytesIO
        from PIL import Image

        buffer = BytesIO()
        Image.new('RGB', (40, 40), color=(200, 160, 60)).save(buffer, format='PNG')
        buffer.seek(0)
        self.valid_png = SimpleUploadedFile(
            'gallery.png', buffer.read(), content_type='image/png')

    def test_staff_can_add_gallery_image(self):
        self.auth(self.admin_token)
        response = self.client.post(
            f'/api/products/{self.product.id}/upload-gallery-image/',
            {'image': self.valid_png, 'alt': 'لقطة جانبية', 'sort_order': 1},
            format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.gallery_images.count(), 1)
        self.assertEqual(self.product.gallery_images.first().alt, 'لقطة جانبية')

    def test_customer_cannot_add_gallery_image(self):
        self.auth(self.customer_token)
        response = self.client.post(
            f'/api/products/{self.product.id}/upload-gallery-image/',
            {'image': self.valid_png}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_gallery_images_in_public_serializer(self):
        from inventory.models import ProductImage
        ProductImage.objects.create(product=self.product, image='products/gallery/t.png')
        response = self.client.get(f'/api/products/{self.product.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['images']), 1)
        self.assertIn('image', response.data['images'][0])
