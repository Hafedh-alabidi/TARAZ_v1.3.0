from decimal import Decimal

from django.db import models
from django.utils import timezone

from users.models import User
from inventory.models import Product


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'قيد الانتظار'),
        ('confirmed', 'مؤكد'),
        ('shipped', 'تم الشحن'),
        ('delivered', 'تم التسليم'),
        ('cancelled', 'ملغي'),
    ]

    order_number = models.CharField(max_length=100, unique=True, editable=False)
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    # قناة الطلب: المتجر الإلكتروني أو نقطة البيع
    channel = models.CharField(
        max_length=20,
        choices=[('online', 'المتجر الإلكتروني'), ('pos', 'نقطة البيع')],
        default='online',
    )
    # من أنشأ الطلب (موظف نقطة البيع أو العميل نفسه)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='orders_created', editable=False
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    final_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # بيانات الشحن (لطلبات المتجر الإلكتروني)
    shipping_name = models.CharField(max_length=255, blank=True)
    shipping_phone = models.CharField(max_length=20, blank=True)
    shipping_address = models.TextField(blank=True)
    shipping_city = models.CharField(max_length=100, blank=True)
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'الطلب'
        verbose_name_plural = 'الطلبات'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"الطلب #{self.order_number}"

    @staticmethod
    def generate_order_number():
        """
        ✅ توليد رقم طلب مقاوم لسباق التنفيذ (P1):
        TRZ-YYYYMMDD-XXXXXX حيث XXXXXX عشوائي (16 مليون احتمال يومياً).
        لا يعتمد على عدّ الصفوف (Count) الذي يسبب تصادماً بين طلبين
        متزامنين — بل عشوائية + فحص وجود + قيد تفرد في قاعدة البيانات
        + إعادة محاولة عند الإنشاء (IntegrityError) في الـ view.
        """
        import secrets
        today = timezone.localtime().strftime('%Y%m%d')
        for _ in range(10):
            number = f"TRZ-{today}-{secrets.token_hex(3).upper()}"
            if not Order.objects.filter(order_number=number).exists():
                return number
        # احتياط نهائي شبه مستحيل التصادم: طابع زمني دقيق + عشوائية
        stamp = timezone.localtime().strftime('%Y%m%d%H%M%S%f')
        return f"TRZ-{stamp}-{secrets.token_hex(2).upper()}"

    def calculate_total(self):
        items_total = sum(item.subtotal for item in self.items.all())
        self.total_amount = items_total
        self.final_amount = items_total - self.discount + self.tax + self.shipping_fee
        self.save(update_fields=['total_amount', 'final_amount', 'updated_at'])

    def can_transition(self, new_status):
        """التحقق من صحة انتقال حالة الطلب"""
        flow = {
            'pending': ['confirmed', 'cancelled'],
            'confirmed': ['shipped', 'cancelled'],
            'shipped': ['delivered', 'cancelled'],
            'delivered': [],
            'cancelled': [],
        }
        return new_status in flow.get(self.status, [])

    def restock_items(self, user=None):
        """إرجاع الكميات للمخزون عند الإلغاء — مع مزامنة السجلات وتسجيل الحركات"""
        from inventory.services import apply_stock_change
        for item in self.items.select_related('product'):
            apply_stock_change(
                product_id=item.product_id,
                delta=item.quantity,
                movement_type='return',
                reference=self.order_number,
                notes=f'إرجاع تلقائي عند إلغاء الطلب',
                user=user,
            )

    @property
    def items_count(self):
        return self.items.count()


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'عنصر الطلب'
        verbose_name_plural = 'عناصر الطلب'

    def __str__(self):
        return f"{self.product.name} - {self.quantity}"

    def save(self, *args, **kwargs):
        self.subtotal = self.quantity * self.unit_price
        super().save(*args, **kwargs)
        self.order.calculate_total()


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'نقدي'),
        ('card', 'بطاقة ائتمان'),
        ('transfer', 'تحويل بنكي'),
        ('wallet', 'محفظة رقمية'),
        ('cod', 'الدفع عند الاستلام'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('pending', 'قيد الانتظار'),
        ('completed', 'مكتمل'),
        ('failed', 'فشل'),
        ('refunded', 'مسترجع'),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    transaction_id = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'الدفع'
        verbose_name_plural = 'الدفعات'
        ordering = ['-created_at']

    def __str__(self):
        return f"الدفع #{self.order.order_number}"


class Commission(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='commission')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=5)
    status = models.CharField(
        max_length=20,
        choices=[('pending', 'قيد الانتظار'), ('paid', 'مدفوع')],
        default='pending'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'العمولة'
        verbose_name_plural = 'العمولات'
        ordering = ['-created_at']

    def __str__(self):
        return f"عمولة الطلب #{self.order.order_number}"
