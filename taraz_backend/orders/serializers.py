from decimal import Decimal

from rest_framework import serializers
from .models import Order, OrderItem, Payment, Commission


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.CharField(source='product.image', read_only=True, default=None)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'product_sku', 'product_image',
                  'quantity', 'unit_price', 'subtotal']


class PaymentSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Payment
        fields = ['id', 'order', 'amount', 'method', 'method_display', 'status',
                  'status_display', 'transaction_id', 'notes', 'created_at']
        read_only_fields = ['order', 'status', 'transaction_id']


class CommissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Commission
        fields = ['id', 'order', 'amount', 'percentage', 'status', 'created_at', 'paid_at']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payment = PaymentSerializer(read_only=True)
    customer_name = serializers.CharField(source='customer.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    items_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'order_number', 'customer', 'customer_name', 'status',
                  'status_display', 'channel', 'channel_display',
                  'total_amount', 'discount', 'tax', 'shipping_fee',
                  'final_amount', 'items', 'items_count', 'payment', 'notes',
                  'shipping_name', 'shipping_phone', 'shipping_address', 'shipping_city',
                  'created_at', 'updated_at']
        read_only_fields = ['order_number', 'total_amount', 'final_amount', 'created_at', 'updated_at']


class OrderDetailSerializer(OrderSerializer):
    commission = CommissionSerializer(read_only=True)

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ['commission']


class CreateOrderSerializer(serializers.Serializer):
    """
    إنشاء طلب — من المتجر الإلكتروني أو نقطة البيع.
    العميل الافتراضي هو المستخدم الحالي ما لم يحدد customer_id (لموظفي نقطة البيع).
    """
    customer_id = serializers.IntegerField(required=False)
    items = serializers.ListField(
        child=serializers.DictField(
            child=serializers.IntegerField(min_value=1),
            required=['product_id', 'quantity']
        ),
        allow_empty=False
    )
    discount = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    payment_method = serializers.ChoiceField(
        choices=['cash', 'card', 'transfer', 'wallet', 'cod'], default='cash'
    )
    # قناة الطلب: نقطة البيع تُنشئ طلباً مكتمل التسليم فوراً
    channel = serializers.ChoiceField(choices=['online', 'pos'], default='online')
    # بيانات الشحن (اختيارية لنقطة البيع، مطلوبة لطلبات المتجر عبر الفرونت)
    shipping_name = serializers.CharField(required=False, allow_blank=True, default='')
    shipping_phone = serializers.CharField(required=False, allow_blank=True, default='')
    shipping_address = serializers.CharField(required=False, allow_blank=True, default='')
    shipping_city = serializers.CharField(required=False, allow_blank=True, default='')


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[s[0] for s in Order.STATUS_CHOICES])
    notes = serializers.CharField(required=False, allow_blank=True)
