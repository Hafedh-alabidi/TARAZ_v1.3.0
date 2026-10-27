from django.contrib import admin
from .models import Order, OrderItem, Payment, Commission

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'customer', 'status', 'total_amount', 'final_amount', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['order_number', 'customer__username']
    inlines = [OrderItemInline]
    fieldsets = (
        ('معلومات الطلب', {'fields': ('order_number', 'customer', 'status')}),
        ('المبالغ', {'fields': ('total_amount', 'discount', 'tax', 'final_amount')}),
        ('ملاحظات', {'fields': ('notes',)}),
    )
    readonly_fields = ['total_amount', 'final_amount']

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'product', 'quantity', 'unit_price', 'subtotal']
    list_filter = ['order__created_at']
    search_fields = ['order__order_number', 'product__name']

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['order', 'amount', 'method', 'status', 'created_at']
    list_filter = ['status', 'method', 'created_at']
    search_fields = ['order__order_number', 'transaction_id']

@admin.register(Commission)
class CommissionAdmin(admin.ModelAdmin):
    list_display = ['order', 'amount', 'percentage', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['order__order_number']
