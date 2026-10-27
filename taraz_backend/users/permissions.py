"""
صلاحيات مبنية على أدوار طراز:
- admin   : مشرف النظام (كل شيء)
- manager : مدير المحل (إدارة كاملة بدون إدارة مستخدمين)
- employee: موظف (نقطة البيع + عرض المخزون + تحديث الكميات)
- customer: عميل (تسوق وطلباته الخاصة فقط)
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS


def get_role(user):
    return getattr(user, 'role', 'customer')


class IsAdmin(BasePermission):
    """مشرف النظام فقط"""
    message = 'هذه العملية متاحة لمشرف النظام فقط.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and get_role(request.user) == 'admin')


class IsAdminOrManager(BasePermission):
    """مشرف النظام أو مدير المحل"""
    message = 'هذه العملية متاحة للمشرف أو مدير المحل فقط.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and get_role(request.user) in ('admin', 'manager'))


class IsStaff(BasePermission):
    """موظفو النظام: admin / manager / employee"""
    message = 'هذه العملية متاحة لموظفي النظام فقط.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and get_role(request.user) in ('admin', 'manager', 'employee'))


class IsStaffOrReadOnly(BasePermission):
    """قراءة عامة، كتابة للموظفين"""
    message = 'التعديل متاح لموظفي النظام فقط.'

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated
                    and get_role(request.user) in ('admin', 'manager', 'employee'))


class IsAdminManagerOrEmployeeWrite(BasePermission):
    """القراءة للجميع، الكتابة للموظفين، حذف/إنشاء للمشرف والمدير"""
    message = 'لا تملك صلاحية تنفيذ هذه العملية.'

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        if not (request.user and request.user.is_authenticated):
            return False
        role = get_role(request.user)
        if request.method == 'DELETE':
            return role in ('admin', 'manager')
        return role in ('admin', 'manager', 'employee')
