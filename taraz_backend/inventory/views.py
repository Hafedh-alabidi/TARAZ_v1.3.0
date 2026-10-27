from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import F, Q
from django.db import transaction

from .models import Product, Category, Supplier, Inventory, StockMovement
from .serializers import (
    ProductSerializer, ProductDetailSerializer, ProductCreateUpdateSerializer,
    PublicProductSerializer, CategorySerializer, CategoryDetailSerializer,
    SupplierSerializer, InventorySerializer, StockMovementSerializer
)
from .services import apply_stock_change
from users.permissions import (
    IsAdminManagerOrEmployeeWrite, IsAdminOrManager, IsStaff, get_role,
)


def _is_staff_user(user):
    """موظفو النظام: admin / manager / employee"""
    return get_role(user) in ('admin', 'manager', 'employee')


class CategoryViewSet(viewsets.ModelViewSet):
    """إدارة الفئات — قراءة عامة، كتابة للمشرف/المدير"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminManagerOrEmployeeWrite]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CategoryDetailSerializer
        return CategorySerializer

    @action(detail=True, methods=['get'])
    def products(self, request, pk=None):
        """منتجات فئة محددة — واجهة عامة بلا بيانات تجارية داخلية"""
        category = self.get_object()
        products = category.products.filter(is_active=True)
        # ✅ أمن بيانات: المسلسل العام للزوار، الكامل للموظفين
        serializer_class = (ProductSerializer if _is_staff_user(request.user)
                            else PublicProductSerializer)
        page = self.paginate_queryset(products)
        if page is not None:
            serializer = serializer_class(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = serializer_class(products, many=True)
        return Response(serializer.data)


class SupplierViewSet(viewsets.ModelViewSet):
    """
    إدارة الموردين — لموظفي النظام فقط (قراءة وكتابة).
    ✅ أمن بيانات: بيانات الموردين (بريد/هاتف/عنوان) معلومات تجارية
    داخلية لا تُنشر للعامة أو للعملاء.
    """
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsStaff]
    search_fields = ['name', 'city', 'email', 'phone']
    ordering_fields = ['name', 'created_at']
    filterset_fields = ['city', 'country']


class ProductViewSet(viewsets.ModelViewSet):
    """
    إدارة المنتجات:
    - القراءة عامة للجميع (المتجر الإلكتروني) — عبر مسلسل عام لا يكشف
      التكلفة/هامش الربح/الكميات الداخلية/المورد (✅ إصلاح تسريب بيانات)
    - الموظفون يرون المسلسل الكامل ويتعاملون مع كل الحقول
    - الإنشاء/التعديل للمشرف والمدير والموظف، والحذف للمشرف والمدير
    """
    queryset = Product.objects.select_related('category', 'supplier').all()
    serializer_class = ProductSerializer
    permission_classes = [IsAdminManagerOrEmployeeWrite]
    filterset_fields = ['category', 'supplier', 'is_active']
    search_fields = ['name', 'description', 'sku', 'barcode']
    ordering_fields = ['price', 'created_at', 'quantity', 'name']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset().prefetch_related('gallery_images')
        # ✅ أمن بيانات: الزوار والعملاء يرون المنتجات النشطة فقط —
        # المنتجات المعطلة قرار تجاري داخلي
        user = getattr(self.request, 'user', None)
        if not (user and user.is_authenticated and _is_staff_user(user)):
            qs = qs.filter(is_active=True)
        # ✅ تجارة: فلتر العروض — المنتجات ذات خصم صحيح فقط
        if self.request.query_params.get('on_sale') == '1':
            qs = qs.filter(compare_at_price__isnull=False).exclude(
                compare_at_price__lte=F('price'))
        return qs

    def get_serializer_class(self):
        user = getattr(self.request, 'user', None)
        staff = user and user.is_authenticated and _is_staff_user(user)
        if self.action in ('list', 'retrieve'):
            # المسلسل الكامل للموظفين، العام لغيرهم
            return ProductSerializer if staff else PublicProductSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return ProductCreateUpdateSerializer
        return ProductSerializer

    @action(detail=True, methods=['post'], url_path='upload-image')
    def upload_image(self, request, pk=None):
        """
        ✅ رفع صورة منتج مباشرة (P1) — موظفو النظام فقط.
        multipart/form-data بحقل image واحد. الحد الأقصى 5MB، صور فقط.
        الصورة المرفوعة تُقدَّم تلقائياً على رابط الصورة الخارجي في كل الواجهات.
        """
        if not _is_staff_user(request.user):
            return Response({'detail': 'رفع الصور متاح لموظفي النظام فقط'},
                            status=status.HTTP_403_FORBIDDEN)
        product = self.get_object()
        image = request.FILES.get('image')
        if not image:
            return Response({'detail': 'يجب إرفاق ملف صورة باسم image'},
                            status=status.HTTP_400_BAD_REQUEST)
        if image.size > 5 * 1024 * 1024:
            return Response({'detail': 'حجم الصورة يجب أن يكون أقل من 5 ميغابايت'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not (image.content_type or '').startswith('image/'):
            return Response({'detail': 'الملف المرفق ليس صورة صالحة'},
                            status=status.HTTP_400_BAD_REQUEST)
        # حذف الملف القديم إن وجد لتفادي تراكم الملفات اليتيمة
        if product.image_file:
            product.image_file.delete(save=False)
        product.image_file = image
        product.save(update_fields=['image_file', 'updated_at'])
        return Response({
            'status': 'تم رفع الصورة بنجاح',
            'product': product.id,
            'image_url': product.image_url,
        })

    @action(detail=True, methods=['post'], url_path='upload-gallery-image')
    def upload_gallery_image(self, request, pk=None):
        """
        ✅ رفع صورة لمعرض المنتج — موظفو النظام فقط.
        multipart/form-data بحقل image و alt اختياري و sort_order اختياري.
        """
        if not _is_staff_user(request.user):
            return Response({'detail': 'رفع الصور متاح لموظفي النظام فقط'},
                            status=status.HTTP_403_FORBIDDEN)
        product = self.get_object()
        image = request.FILES.get('image')
        if not image:
            return Response({'detail': 'يجب إرفاق ملف صورة باسم image'},
                            status=status.HTTP_400_BAD_REQUEST)
        if image.size > 5 * 1024 * 1024:
            return Response({'detail': 'حجم الصورة يجب أن يكون أقل من 5 ميغابايت'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not (image.content_type or '').startswith('image/'):
            return Response({'detail': 'الملف المرفق ليس صورة صالحة'},
                            status=status.HTTP_400_BAD_REQUEST)
        from .models import ProductImage
        from .serializers import ProductImageSerializer
        gallery_image = ProductImage.objects.create(
            product=product,
            image=image,
            alt=(request.data.get('alt') or '')[:255],
            sort_order=int(request.data.get('sort_order') or 0),
        )
        return Response({
            'status': 'تمت إضافة صورة المعرض بنجاح',
            'product': product.id,
            'image': ProductImageSerializer(gallery_image).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """المنتجات التي وصلت للحد الأدنى — لموظفي النظام فقط"""
        if not _is_staff_user(request.user):
            return Response({'detail': 'هذه البيانات متاحة لموظفي النظام فقط'},
                            status=status.HTTP_403_FORBIDDEN)
        products = Product.objects.filter(quantity__lt=F('min_quantity'))
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def out_of_stock(self, request):
        """المنتجات المنتهية من المخزون — لموظفي النظام فقط"""
        if not _is_staff_user(request.user):
            return Response({'detail': 'هذه البيانات متاحة لموظفي النظام فقط'},
                            status=status.HTTP_403_FORBIDDEN)
        products = Product.objects.filter(quantity__lte=0)
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def update_quantity(self, request, pk=None):
        """
        تحديث كمية منتج: {'quantity': 50} كمية جديدة
        أو {'delta': -5} لخصم/إضافة نسبية
        كل تغيير يُسجل كحركة تسوية مع مزامنة سجل المخزون
        """
        product = self.get_object()
        if 'delta' in request.data:
            try:
                delta = int(request.data['delta'])
            except (TypeError, ValueError):
                return Response({'detail': 'قيمة delta يجب أن تكون رقماً'}, status=status.HTTP_400_BAD_REQUEST)
        elif 'quantity' in request.data:
            try:
                new_qty = int(request.data['quantity'])
            except (TypeError, ValueError):
                return Response({'detail': 'قيمة quantity يجب أن تكون رقماً'}, status=status.HTTP_400_BAD_REQUEST)
            delta = new_qty - product.quantity
        else:
            return Response({'detail': 'يجب إرسال quantity أو delta'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            apply_stock_change(
                product_id=product.pk,
                delta=delta,
                movement_type='adjustment',
                reference='MANUAL',
                notes=request.data.get('notes', 'تسوية يدوية من لوحة الإدارة'),
                user=request.user,
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        product.refresh_from_db()
        return Response({'status': 'تم تحديث الكمية بنجاح', 'quantity': product.quantity}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def restock(self, request, pk=None):
        """إعادة تخزين: {'amount': 25} — مع مزامنة السجلات وتسجيل الحركة"""
        product = self.get_object()
        try:
            amount = int(request.data.get('amount', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'قيمة amount يجب أن تكون رقماً'}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({'detail': 'يجب أن تكون الكمية المضافة أكبر من صفر'}, status=status.HTTP_400_BAD_REQUEST)

        apply_stock_change(
            product_id=product.pk,
            delta=amount,
            movement_type='in',
            reference=request.data.get('reference', 'RESTOCK'),
            notes=request.data.get('notes', 'إدخال مخزون جديد'),
            user=request.user,
        )
        product.refresh_from_db()
        return Response({'status': 'تمت إعادة التخزين', 'quantity': product.quantity}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """تصفية حسب الفئة: /api/products/by_category/?category_id=3"""
        category_id = request.query_params.get('category_id')
        if not category_id:
            return Response({'detail': 'يجب تحديد الفئة'}, status=status.HTTP_400_BAD_REQUEST)
        products = Product.objects.filter(category_id=category_id)
        if not _is_staff_user(request.user):
            products = products.filter(is_active=True)
        serializer_class = (ProductSerializer if _is_staff_user(request.user)
                            else PublicProductSerializer)
        serializer = serializer_class(products, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        بحث بالباركود أو SKU للـ POS — لموظفي النظام فقط.
        ✅ أمن بيانات: نتيجة البحث تُظهر التكلفة والكميات، فلا تُتاح للعامة.
        """
        if not _is_staff_user(request.user):
            return Response({'detail': 'بحث المنتجات الكامل متاح لموظفي النظام فقط'},
                            status=status.HTTP_403_FORBIDDEN)
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response([], status=status.HTTP_200_OK)
        products = Product.objects.filter(
            Q(barcode__iexact=q) | Q(sku__iexact=q) | Q(name__icontains=q),
            is_active=True
        )[:20]
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """حذف منطقي (تعطيل) إن كان للمنتج طلبات، وإلا حذف فعلي"""
        product = self.get_object()
        from orders.models import OrderItem
        if OrderItem.objects.filter(product=product).exists():
            product.is_active = False
            product.save(update_fields=['is_active', 'updated_at'])
            return Response({'status': 'المنتج مرتبط بطلبات — تم تعطيله بدلاً من حذفه'},
                            status=status.HTTP_200_OK)
        product.delete()
        return Response({'status': 'تم حذف المنتج'}, status=status.HTTP_204_NO_CONTENT)


class InventoryViewSet(viewsets.ModelViewSet):
    """سجلات المخزون التفصيلية — للموظفين"""
    queryset = Inventory.objects.select_related('product').all()
    serializer_class = InventorySerializer
    permission_classes = [IsStaff]

    @action(detail=False, methods=['get'])
    def low_stock_alert(self, request):
        """تنبيهات الكميات المنخفضة"""
        inventories = Inventory.objects.filter(
            quantity_in_stock__lt=F('product__min_quantity')
        ).select_related('product')
        serializer = InventorySerializer(inventories, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """إعادة مزامنة كل سجلات المخزون من كميات المنتجات — للمشرف"""
        from .services import sync_all_inventory
        if not (request.user.is_staff or getattr(request.user, 'role', '') == 'admin'):
            return Response({'detail': 'هذه العملية متاحة للمشرف فقط'}, status=status.HTTP_403_FORBIDDEN)
        count = sync_all_inventory()
        return Response({'status': 'تمت مزامنة سجلات المخزون', 'records': count})


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    سجل حركات المخزون (قراءة فقط) — للموظفين:
    تدقيق كامل لكل بيع وإرجاع وإدخال وتسوية
    """
    queryset = StockMovement.objects.select_related('product', 'created_by').all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsStaff]
    filterset_fields = ['product', 'movement_type']
    search_fields = ['product__name', 'product__sku', 'reference', 'notes']
    ordering_fields = ['created_at', 'quantity']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'])
    def product_history(self, request):
        """سجل حركات منتج محدد: /api/stock-movements/product_history/?product_id=3"""
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({'detail': 'يجب تحديد product_id'}, status=status.HTTP_400_BAD_REQUEST)
        movements = StockMovement.objects.filter(product_id=product_id).select_related('product', 'created_by')[:100]
        serializer = StockMovementSerializer(movements, many=True)
        return Response(serializer.data)
