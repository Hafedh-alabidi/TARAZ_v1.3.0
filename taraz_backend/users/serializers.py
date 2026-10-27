from rest_framework import serializers
from django.contrib.auth import authenticate, password_validation
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """عرض/تعديل بيانات المستخدم الأساسية — الدور والحالة للقراءة فقط.
    تعديل الدور والحالة متاح للمشرف فقط عبر UserManageSerializer.
    """
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role',
                  'role_display', 'phone', 'store_name', 'address', 'city', 'country',
                  'is_active', 'created_at']
        read_only_fields = ['id', 'role', 'role_display', 'is_active', 'created_at']


class UserManageSerializer(serializers.ModelSerializer):
    """
    إدارة المستخدمين — للمشرف فقط: تعيين الدور وتنشيط/تعطيل الحساب
    وكلمة مرور اختيارية عند الإنشاء أو إعادة التعيين.
    """
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, min_length=8,
        style={'input_type': 'password'},
        help_text='اختياري — كلمة مرور الحساب (8 أحرف على الأقل)')

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role',
                  'role_display', 'phone', 'store_name', 'address', 'city', 'country',
                  'is_active', 'password', 'created_at']
        read_only_fields = ['id', 'role_display', 'created_at']

    def validate_password(self, value):
        if value:
            password_validation.validate_password(value)
        return value

    def validate_role(self, value):
        # المشرف لا يستطيع منح مشرفين آخرين إلا هو نفسه... يُسمح بكل الأدوار هنا:
        # هذا المسار للمشرف حصراً (راجع get_serializer_class في views)
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', '')
        validated_data.setdefault('role', 'customer')
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', '')
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=['password'])
        return user


class UserDetailSerializer(serializers.ModelSerializer):
    """
    تفاصيل المستخدم — للقراءة فقط في حقول الدور والصلاحيات.
    هذا المسلسل لا يُستخدم لأي مسار كتابة (كان سبب ثغرة تصعيد الصلاحيات).
    """
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role',
                  'role_display', 'phone', 'store_name', 'address', 'city', 'country',
                  'is_active', 'is_staff', 'created_at', 'updated_at', 'last_login']
        read_only_fields = ['id', 'role', 'role_display', 'is_active', 'is_staff',
                            'created_at', 'updated_at', 'last_login']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})
    password2 = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'first_name', 'last_name', 'phone']
        extra_kwargs = {'email': {'required': True}}

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('هذا البريد الإلكتروني مسجل مسبقاً.')
        return value

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('اسم المستخدم مستخدم مسبقاً.')
        return value

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password2': 'كلمات المرور غير متطابقة'})
        password_validation.validate_password(data['password'], User(username=data['username']))
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        # التسجيل العام ينشئ عملاء فقط — الأدوار الأخرى تُنشأ من لوحة الإدارة
        validated_data['role'] = 'customer'
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user:
            raise serializers.ValidationError({'detail': 'بيانات الدخول غير صحيحة'})
        if not user.is_active:
            raise serializers.ValidationError({'detail': 'هذا الحساب معطل — تواصل مع الإدارة'})
        data['user'] = user
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('كلمة المرور الحالية غير صحيحة')
        return value

    def validate_new_password(self, value):
        password_validation.validate_password(value, self.context['request'].user)
        return value

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """تحديث الملف الشخصي — حقول آمنة فقط (لا دور ولا صلاحيات ولا حالة)"""

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'phone',
                  'address', 'city', 'country', 'store_name']

    def validate_email(self, value):
        # منع انتحال بريد مستخدم آخر
        qs = User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk) \
            if self.instance else User.objects.filter(email__iexact=value)
        if qs.exists():
            raise serializers.ValidationError('هذا البريد الإلكتروني مسجل لمستخدم آخر.')
        return value


# ============================================================
# ✅ استعادة كلمة المرور (P0) — طلب رمز + تأكيد التعيين
# ============================================================

class PasswordResetRequestSerializer(serializers.Serializer):
    """طلب استعادة كلمة المرور عبر البريد الإلكتروني المسجل."""
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """تأكيد الاستعادة: uid + token (من رابط البريد) + كلمة المرور الجديدة."""
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8,
                                         style={'input_type': 'password'})
    new_password2 = serializers.CharField(write_only=True, min_length=8,
                                          style={'input_type': 'password'})

    def validate(self, data):
        if data['new_password'] != data['new_password2']:
            raise serializers.ValidationError(
                {'new_password2': 'كلمات المرور غير متطابقة'})
        # سياسة كلمة المرور تُفحص في العرض مقابل المستخدم الفعلي
        return data
