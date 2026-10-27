from django.db import models
from users.models import User

class Category(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'الفئة'
        verbose_name_plural = 'الفئات'
        ordering = ['name']
    
    def __str__(self):
        return self.name

class Supplier(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20)
    address = models.TextField()
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'المورد'
        verbose_name_plural = 'الموردون'
        ordering = ['name']
    
    def __str__(self):
        return self.name

class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    # ✅ تجارة: سعر ما قبل الخصم (للعرض المشطوب) — فارغ = لا خصم
    compare_at_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='السعر قبل الخصم لعرضه مشطوباً — يُترك فارغاً إن لم يكن هناك تخفيض')
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity = models.IntegerField(default=0)
    min_quantity = models.IntegerField(default=10)
    sku = models.CharField(max_length=100, unique=True)
    barcode = models.CharField(max_length=100, blank=True)
    image = models.URLField(blank=True)
    # ✅ رفع صور مباشر من الإدارة (P1): ملف صورة يُخزن خادمياً
    image_file = models.ImageField(
        upload_to='products/%Y/%m/', blank=True, null=True,
        help_text='صورة المنتج المرفوعة مباشرة — تُقدَّم على رابط الصورة الخارجي')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'المنتج'
        verbose_name_plural = 'المنتجات'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name

    @property
    def image_url(self):
        """الصورة الفعلية: الملف المرفوع أولاً، ثم رابط الصورة الخارجي"""
        if self.image_file:
            return self.image_file.url
        return self.image

    @property
    def discount_percent(self):
        """نسبة الخصم الصحيحة فقط (سعر قبل الخصم أعلى من السعر الحالي)"""
        if not self.compare_at_price:
            return None
        compare = float(self.compare_at_price)
        price = float(self.price)
        if compare > price > 0:
            return round((compare - price) / compare * 100)
        return None

    @property
    def profit_margin(self):
        if self.price > 0:
            return ((self.price - self.cost) / self.price) * 100
        return 0

class ProductImage(models.Model):
    """صور معرض المنتج — تُعرض في صفحة المنتج كبطاقات مصغرة قابلة للتبديل"""
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='gallery_images')
    image = models.ImageField(upload_to='products/gallery/%Y/%m/')
    alt = models.CharField(max_length=255, blank=True, help_text='وصف الصورة لإمكانية الوصول')
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'صورة معرض'
        verbose_name_plural = 'صور المعارض'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"صورة معرض — {self.product.name} #{self.sort_order}"


class Inventory(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name='inventory')
    quantity_in_stock = models.IntegerField(default=0)
    quantity_reserved = models.IntegerField(default=0)
    last_restock_date = models.DateTimeField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'المخزون'
        verbose_name_plural = 'المخزونات'

    def __str__(self):
        return f"{self.product.name} - {self.quantity_in_stock}"

    @property
    def available_quantity(self):
        return self.quantity_in_stock - self.quantity_reserved


class StockMovement(models.Model):
    """
    سجل حركة المخزون — تدقيق كامل لكل تغيير على الكميات:
    بيع (out)، إرجاع عند الإلغاء (return)، إدخال مخزون (in)، تسوية يدوية (adjustment)
    """
    MOVEMENT_CHOICES = [
        ('out', 'إخراج - بيع'),
        ('return', 'إرجاع - إلغاء طلب'),
        ('in', 'إدخال - إعادة تخزين'),
        ('adjustment', 'تسوية يدوية'),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_CHOICES)
    quantity = models.IntegerField(help_text='الكمية بالإشارة: سالبة للإخراج، موجبة للإدخال')
    stock_after = models.IntegerField(help_text='رصيد المنتج بعد الحركة')
    reference = models.CharField(max_length=100, blank=True, help_text='رقم الطلب أو مرجع الحركة')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'حركة مخزون'
        verbose_name_plural = 'حركات المخزون'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['product', '-created_at']),
            models.Index(fields=['movement_type']),
        ]

    def __str__(self):
        return f"{self.get_movement_type_display()} — {self.product.name} ({self.quantity:+d})"
