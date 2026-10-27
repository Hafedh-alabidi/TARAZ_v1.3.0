from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import ScopedRateThrottle

from django.contrib.auth import logout as django_logout, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.conf import settings
from django.template.loader import render_to_string

from .models import User
from .serializers import (UserSerializer, UserDetailSerializer, ProfileUpdateSerializer,
                          UserManageSerializer, RegisterSerializer, LoginSerializer,
                          ChangePasswordSerializer, PasswordResetRequestSerializer,
                          PasswordResetConfirmSerializer)
from .permissions import IsAdminOrManager


class UserViewSet(viewsets.ModelViewSet):
    """
    إدارة المستخدمين — متاحة للمشرف ومدير المحل فقط.
    الاستثناءات: me / update_me / change_password متاحة لكل مستخدم مسجل.
    العملاء الجدد يُسجلون عبر /api/auth/register/ العام.
    """
    queryset = User.objects.all().order_by('-created_at')
    filterset_fields = ['role', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name', 'phone', 'store_name']
    ordering_fields = ['created_at', 'username']

    def get_permissions(self):
        if self.action in ('me', 'update_me', 'change_password'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrManager()]

    def get_serializer_class(self):
        if self.action in ('retrieve', 'me'):
            return UserDetailSerializer
        if self.action == 'update_me':
            return ProfileUpdateSerializer
        if self.action in ('create', 'update', 'partial_update'):
            # ✅ إصلاح أمني: تعيين الدور/الحالة للمشرف فقط —
            # المدير يعدّل البيانات الأساسية دون صلاحيات (منع تصعيد الصلاحيات)
            if getattr(self.request.user, 'role', '') == 'admin':
                return UserManageSerializer
            return UserSerializer
        return UserSerializer

    @action(detail=False, methods=['get'])
    def me(self, request):
        """بيانات المستخدم الحالي"""
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['patch', 'put'])
    def update_me(self, request):
        """تحديث بيانات الملف الشخصي الحالي — حقول آمنة فقط (لا دور ولا صلاحيات)"""
        # ✅ إصلاح حرج: كان يستخدم UserDetailSerializer الذي يسمح بتعديل
        # role/is_staff/is_active — ثغرة تصعيد صلاحيات من المستوى حرج جداً
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserDetailSerializer(request.user).data)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """تغيير كلمة المرور للحساب الحالي + إبطال جميع الجلسات وإصدار رمز جديد"""
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # ✅ أمن: تغيير كلمة المرور يبطل كل الرموز القديمة (منع جلسات متبقية)
        Token.objects.filter(user=request.user).delete()
        token = Token.objects.create(user=request.user)
        return Response({'status': 'تم تغيير كلمة المرور بنجاح', 'token': token.key})

    @action(detail=False, methods=['get'])
    def by_role(self, request):
        """تصفية المستخدمين حسب الدور: /api/users/by_role/?role=customer"""
        role = request.query_params.get('role')
        if not role:
            return Response({'detail': 'يجب تحديد الدور'}, status=status.HTTP_400_BAD_REQUEST)
        users = User.objects.filter(role=role)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def customers(self, request):
        """قائمة العملاء"""
        users = User.objects.filter(role='customer')
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)


class RegisterView(APIView):
    """تسجيل عميل جديد — متاح للجميع (مع تحديد معدل المحاولات)"""
    permission_classes = [AllowAny]
    # ✅ إصلاح CSRF: نقطة دخول عامة بالرموز — تعطيل SessionAuthentication
    # حتى لا يُفرض فحص CSRF على من لديه جلسة Django admin نشطة في متصفحه
    authentication_classes = []
    # ✅ أمن: تحديد معدل التسجيل لمنع الإساءة وإنشاء حسابات آلية
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'user': UserSerializer(user).data,
                'token': token.key
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """تسجيل الدخول — متاح للجميع (مع تحديد معدل المحاولات ضد التخمين)"""
    permission_classes = [AllowAny]
    # ✅ إصلاح CSRF (خطأ: CSRF Failed: CSRF token missing):
    # المصادقة هنا بالرموز (Token) لا بالجلسات. بدون هذا التعطيل، من يسجّل
    # دخوله للوحة /admin/ أولاً تُرسل واجهته كوكي sessionid مع طلب الدخول
    # هنا فيفرض DRF فحص CSRF ويفشل الطلب. هذه نقاط دخول عامة بالكامل.
    authentication_classes = []
    # ✅ أمن: تحديد معدل محاولات الدخول لمنع هجمات التخمين Brute-force
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'user': UserDetailSerializer(user).data,
                'token': token.key
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """تسجيل الخروج — يحذف الـ Token الحالي"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            request.auth.delete()
        except Exception:
            pass
        django_logout(request)
        return Response({'status': 'تم تسجيل الخروج بنجاح'})


# ============================================================
# ✅ استعادة كلمة المرور (P0) — الطلب + التأكيد
# ============================================================

class PasswordResetRequestView(APIView):
    """
    طلب استعادة كلمة المرور عبر البريد الإلكتروني.

    ✅ أمن (منع تعداد المستخدمين): تُعاد رسالة نجاح عامة دائماً سواء
    وُجد البريد أو لم يوجد — لا يُكشف للطرف الخارجي ما إذا كان البريد
    مسجلاً في النظام. الرابط يُرسل فقط إن وُجد الحساب.

    الرمز صالح لاستخدام واحد ولمدة 24 ساعة (سلوك default_token_generator
    مع PASSWORD_RESET_TIMEOUT الافتراضي).
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = (f"{settings.FRONTEND_URL.rstrip('/')}"
                         f"/reset-password?uid={uid}&token={token}")

            subject = 'استعادة كلمة المرور — متجر طراز'
            message = (
                f'مرحباً {user.first_name or user.username}،\n\n'
                f'تلقينا طلباً لإعادة تعيين كلمة مرور حسابك في متجر طراز.\n'
                f'افتح الرابط التالي لاختيار كلمة مرور جديدة:\n\n'
                f'{reset_url}\n\n'
                f'الرابط صالح لمرة واحدة وينتهي خلال 24 ساعة.\n'
                f'إن لم تطلب ذلك فتجاهل هذه الرسالة — كلمة مرورك الحالية لن تتغير.\n\n'
                f'متجر طراز'
            )
            try:
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL,
                          [user.email], fail_silently=False)
            except Exception:
                # لا نكشف فشل الإرسال للعميل (نفس سبب منع التعداد)
                # لكن نسجّله للمراقبة
                import logging
                logging.getLogger('taraz.mail').exception(
                    'فشل إرسال بريد استعادة كلمة المرور')

        return Response({
            'detail': 'إن كان البريد مسجلاً لدينا فستصلك رسالة تحتوي '
                      'رابط إعادة تعيين كلمة المرور خلال دقائق.'
        })


class PasswordResetConfirmView(APIView):
    """
    تأكيد استعادة كلمة المرور: uid + token + كلمة المرور الجديدة.

    ✅ أمن: التحقق من الرمز أحادي الاستخدام عبر default_token_generator،
    وإبطال جميع رموز الجلسات (Tokens) القديمة بعد التعيين — لا تبقى
    جلسة قديمة مفتوحة بعد تغيير كلمة المرور.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # فك uid والحصول على المستخدم
        try:
            uid = urlsafe_base64_decode(data['uid']).decode()
            user = User.objects.get(pk=uid, is_active=True)
        except (TypeError, ValueError, OverflowError,
                User.DoesNotExist, UnicodeDecodeError):
            return Response(
                {'detail': 'رابط الاستعادة غير صالح أو منتهي الصلاحية — اطلب رابطاً جديداً'},
                status=status.HTTP_400_BAD_REQUEST)

        # التحقق من الرمز أحادي الاستخدام
        if not default_token_generator.check_token(user, data['token']):
            return Response(
                {'detail': 'رابط الاستعادة غير صالح أو استُخدم مسبقاً — اطلب رابطاً جديداً'},
                status=status.HTTP_400_BAD_REQUEST)

        # سياسة كلمة المرور
        from django.contrib.auth import password_validation
        try:
            password_validation.validate_password(data['new_password'], user)
        except Exception as err:
            return Response({'new_password': err.messages},
                            status=status.HTTP_400_BAD_REQUEST)

        user.set_password(data['new_password'])
        user.save(update_fields=['password'])
        # ✅ إبطال كل الجلسات القديمة
        Token.objects.filter(user=user).delete()

        return Response({'detail': 'تم تعيين كلمة المرور الجديدة — يمكنك تسجيل الدخول الآن'})
