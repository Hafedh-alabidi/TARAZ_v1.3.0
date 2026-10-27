"""
خدمات المخزون — نقطة واحدة لتغيير كميات المنتجات.

كل تغيير على كمية منتج يجب أن يمر عبر apply_stock_change() لضمان:
1. تحديث Product.quantity بشكل آمن ضد التزامن (F expressions)
2. مزامنة سجل Inventory.quantity_in_stock (مصدر واحد للحقيقة)
3. تسجيل حركة StockMovement للتدقيق الكامل
"""
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import Product, Inventory, StockMovement


@transaction.atomic
def apply_stock_change(product_id, delta, movement_type, reference='', notes='', user=None):
    """
    تطبيق تغيير على مخزون منتج بشكل ذرّي آمن.

    Args:
        product_id: معرف المنتج
        delta: التغيير بالإشارة (سالب للبيع، موجب للإرجاع/التخزين)
        movement_type: 'out' | 'return' | 'in' | 'adjustment'
        reference: رقم الطلب أو مرجع العملية
        notes: ملاحظات اختيارية
        user: المستخدم المنفذ (اختياري)

    Raises:
        Product.DoesNotExist إذا كان المنتج غير موجود
        ValueError إذا كانت الحركة ستجعل الكمية سالبة
    """
    if delta == 0:
        return None

    # قفل صف المنتج لضمان عدم التزامن
    product = Product.objects.select_for_update().get(pk=product_id)

    new_quantity = product.quantity + delta
    if new_quantity < 0:
        raise ValueError(
            f'الكمية بعد الحركة ستكون سالبة ({new_quantity}) — المتاح حالياً: {product.quantity}'
        )

    # تحديث كمية المنتج بأمان
    Product.objects.filter(pk=product.pk).update(quantity=F('quantity') + delta)
    product.quantity = new_quantity

    # مزامنة سجل Inventory (إنشاءه إن لم يوجد)
    inv_defaults = {'quantity_in_stock': new_quantity}
    if movement_type == 'in':
        inv_defaults['last_restock_date'] = timezone.now()
    Inventory.objects.update_or_create(product=product, defaults=inv_defaults)

    # تسجيل حركة المخزون للتدقيق
    return StockMovement.objects.create(
        product=product,
        movement_type=movement_type,
        quantity=delta,
        stock_after=new_quantity,
        reference=reference,
        notes=notes,
        created_by=user,
    )


def sync_all_inventory():
    """
    إعادة مزامنة سجلات Inventory بالكامل من Product.quantity —
    تُستخدم بعد الترحيل أو للتصحيح الدوري.
    """
    for product in Product.objects.all():
        Inventory.objects.update_or_create(
            product=product,
            defaults={'quantity_in_stock': product.quantity},
        )
    return Inventory.objects.count()
