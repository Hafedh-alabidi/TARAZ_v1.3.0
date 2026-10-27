from rest_framework import serializers
from django.utils import timezone
from .models import Product, Category, Supplier, Inventory, StockMovement, ProductImage


class ProductImageSerializer(serializers.ModelSerializer):
    """صورة من معرض المنتج — للعرض في صفحة المنتج"""

    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'alt', 'sort_order']


class CategorySerializer(serializers.ModelSerializer):
    products_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'icon', 'products_count', 'created_at']

    def get_products_count(self, obj):
        return obj.products.filter(is_active=True).count()


class CategoryDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'icon', 'created_at']


class SupplierSerializer(serializers.ModelSerializer):
    products_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = ['id', 'name', 'email', 'phone', 'address', 'city', 'country',
                  'products_count', 'created_at']

    def get_products_count(self, obj):
        return obj.products.count()


class InventorySerializer(serializers.ModelSerializer):
    available_quantity = serializers.ReadOnlyField()
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = Inventory
        fields = ['id', 'product', 'product_name', 'quantity_in_stock', 'quantity_reserved',
                  'available_quantity', 'last_restock_date', 'last_updated']


class StockMovementSerializer(serializers.ModelSerializer):
    """سجل حركة مخزون — للتدقيق"""
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    movement_type_display = serializers.CharField(source='get_movement_type_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default=None)

    class Meta:
        model = StockMovement
        fields = ['id', 'product', 'product_name', 'product_sku', 'movement_type',
                  'movement_type_display', 'quantity', 'stock_after', 'reference',
                  'notes', 'created_by', 'created_by_name', 'created_at']


class PublicProductSerializer(serializers.ModelSerializer):
    """
    ✅ أمن بيانات: مسلسل المتجر العام — ما يجوز للعميل/الزائر رؤيته فقط:
    الاسم والوصف والصورة والسعر والفئة وحالة التوافر.

    يستثني عمداً: التكلفة (cost)، هامش الربح (profit_margin)، الكميات
    الداخلية (quantity/min_quantity)، بيانات المورد، والباركود.
    الموظفون يرون المسلسل الكامل عبر نفس الـ endpoint (راجع views).
    """
    category_name = serializers.CharField(source='category.name', read_only=True)
    in_stock = serializers.SerializerMethodField()
    availability = serializers.SerializerMethodField()
    # ✅ P1 رفع الصور: الصورة الفعلية (ملف مرفوع أو رابط خارجي)
    image_url = serializers.ReadOnlyField()
    # ✅ تجارة: سعر ما قبل الخصم ونسبة الخصم + معرض الصور
    discount_percent = serializers.ReadOnlyField()
    images = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'category', 'category_name',
                  'price', 'compare_at_price', 'discount_percent', 'sku', 'image', 'image_url',
                  'is_active', 'in_stock', 'availability', 'images', 'created_at']

    def get_images(self, obj):
        qs = obj.gallery_images.all()
        if not qs:
            return []
        return [ProductImageSerializer(img).data for img in qs]

    def get_in_stock(self, obj):
        return obj.quantity > 0

    def get_availability(self, obj):
        if obj.quantity <= 0:
            return 'out_of_stock'
        if obj.quantity <= obj.min_quantity:
            return 'low_stock'
        return 'in_stock'


class ProductSerializer(serializers.ModelSerializer):
    """المسلسل الكامل — لموظفي النظام فقط (التكلفة والهوامش والمورد والكميات)"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)
    profit_margin = serializers.ReadOnlyField()
    discount_percent = serializers.ReadOnlyField()
    in_stock = serializers.SerializerMethodField()
    image_url = serializers.ReadOnlyField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'category', 'category_name',
                  'supplier', 'supplier_name', 'price', 'compare_at_price', 'discount_percent',
                  'cost', 'quantity', 'min_quantity', 'sku', 'barcode', 'image', 'image_url',
                  'profit_margin', 'in_stock', 'is_active', 'created_at', 'updated_at']

    def get_in_stock(self, obj):
        return obj.quantity > obj.min_quantity


class ProductDetailSerializer(serializers.ModelSerializer):
    category = CategoryDetailSerializer(read_only=True)
    supplier = SupplierSerializer(read_only=True)
    inventory = InventorySerializer(read_only=True)
    profit_margin = serializers.ReadOnlyField()
    in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'category', 'category_name', 'supplier',
                  'supplier_name', 'price', 'cost', 'quantity', 'min_quantity', 'sku',
                  'barcode', 'image', 'profit_margin', 'in_stock', 'is_active',
                  'inventory', 'created_at', 'updated_at']

    def get_in_stock(self, obj):
        return obj.quantity > obj.min_quantity

    # حقول محسوبة إضافية للتوافق
    category_name = serializers.CharField(source='category.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    """إنشاء/تحديث منتج — كتابة موظفي النظام"""

    class Meta:
        model = Product
        fields = ['name', 'description', 'category', 'supplier', 'price', 'cost',
                  'quantity', 'min_quantity', 'sku', 'barcode', 'image', 'is_active']

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('السعر يجب أن يكون أكبر من صفر')
        return value

    def validate_cost(self, value):
        if value < 0:
            raise serializers.ValidationError('التكلفة لا يمكن أن تكون سالبة')
        return value

    def validate_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError('الكمية لا يمكن أن تكون سالبة')
        return value

    def validate_sku(self, value):
        qs = Product.objects.filter(sku__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('رمز SKU مستخدم مسبقاً')
        return value

    def create(self, validated_data):
        product = super().create(validated_data)
        # إنشاء سجل مخزون تلقائي
        Inventory.objects.create(
            product=product,
            quantity_in_stock=product.quantity,
            last_restock_date=timezone.now(),
        )
        return product
