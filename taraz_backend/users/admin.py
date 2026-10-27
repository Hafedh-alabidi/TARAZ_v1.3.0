from django.contrib import admin
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'role', 'store_name', 'is_active', 'created_at']
    list_filter = ['role', 'is_active', 'created_at']
    search_fields = ['username', 'email', 'store_name']
    fieldsets = (
        ('بيانات الدخول', {'fields': ('username', 'password')}),
        ('المعلومات الشخصية', {'fields': ('first_name', 'last_name', 'email', 'phone')}),
        ('معلومات المحل', {'fields': ('store_name', 'address', 'city', 'country')}),
        ('الصلاحيات', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('التواريخ', {'fields': ('created_at', 'updated_at', 'last_login')}),
    )
    readonly_fields = ['created_at', 'updated_at', 'last_login']
