"""
مصادقة الرموز مع سياسة انتهاء صلاحية.

DRF TokenAuthentication الأصلية لا تنتهي صلاحيتها أبداً — الرمز المسرب
يظل صالحاً مدى الحياة. هذه الطبقة تضيف:
- انتهاء صلاحية بعد TARAZ_TOKEN_TTL_DAYS (افتراضياً 30 يوماً) من الإنشاء
- حذف الرمز منتهي الصلاحية تلقائياً (إبطال فوري)
- الإبطال عند تسجيل الخروج (يحذف الرمز) وعند تغيير كلمة المرور (يحذف الكل)
"""
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import exceptions
from rest_framework.authentication import TokenAuthentication


class ExpiringTokenAuthentication(TokenAuthentication):
    """مصادقة Token مع انتهاء صلاحية قابل للضبط من متغيرات البيئة."""

    keyword = 'Token'

    def authenticate_credentials(self, key):
        model = self.get_model()
        try:
            token = model.objects.select_related('user').get(key=key)
        except model.DoesNotExist:
            raise exceptions.AuthenticationFailed('رمز مصادقة غير صالح.')

        if not token.user.is_active:
            raise exceptions.AuthenticationFailed('هذا الحساب معطل.')

        ttl_days = getattr(settings, 'TARAZ_TOKEN_TTL_DAYS', 30)
        expires_at = token.created + timedelta(days=ttl_days)
        if timezone.now() > expires_at:
            # إبطال فوري للرمز المنتهي — لا يُقبل مجدداً
            token.delete()
            raise exceptions.AuthenticationFailed(
                'انتهت صلاحية الجلسة — سجّل الدخول من جديد.')

        return (token.user, token)
