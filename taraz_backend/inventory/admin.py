from django.contrib import admin
from .models import Category, Supplier, Product, Inventory

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'phone', 'city', 'created_at']
    search_fields = ['name', 'email', 'city']
    list_filter = ['city', 'country']

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'supplier', 'price', 'quantity', 'is_active', 'created_at']
    list_filter = ['category', 'supplier', 'is_active', 'created_at']
    search_fields = ['name', 'sku', 'barcode']
    fieldsets = (
        ('المعلومات الأساسية', {'fields': ('name', 'description', 'category', 'supplier')}),
        ('الأسعار والكميات', {'fields': ('price', 'cost', 'quantity', 'min_quantity')}),
        ('معرفات المنتج', {'fields': ('sku', 'barcode')}),
        ('الحالة', {'fields': ('is_active', 'image')}),
    )

@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ['product', 'quantity_in_stock', 'quantity_reserved', 'available_quantity', 'last_updated']
    list_filter = ['last_updated']
    search_fields = ['product__name']
    readonly_fields = ['available_quantity', 'last_updated']
