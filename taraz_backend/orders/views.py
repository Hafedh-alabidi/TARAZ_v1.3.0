from decimal import Decimal
from collections import defaultdict

from django.db import transaction, models, IntegrityError
from django.db.models import Sum, F, Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import Order, OrderItem, Payment, Commission
from .serializers import (
    OrderSerializer, OrderDetailSerializer, PaymentSerializer,
    CommissionSerializer, CreateOrderSerializer
)
from .zatca import build_invoice_qr
from .payment_gateway import get_provider, PaymentError
from inventory.models import Product
from inventory.services import apply_stock_change
from users.models import User
from users.permissions import IsStaff, IsAdminOrManager


STAFF_ROLES = ('admin', 'manager', 'employee')


def is_staff_user(user):
    return getattr(user, 'role', 'customer') in STAFF_ROLES


class OrderViewSet(viewsets.ModelViewSet):
    """
    إدارة الطلبات:
    - الموظفون يرون كل الطلبات، العملاء يرون طلباتهم فقط
    - الإنشاء متاح لكل المستخدمين المسجلين (شراء من المتجر أو نقطة البيع)
    - تغيير الحالة للموظفين مع التحقق من مسار الحالة
    """
    queryset = Order.objects.select_related('customer', 'payment', 'commission').prefetch_related('items__product').all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'customer']
    ordering_fields = ['created_at', 'total_amount', 'final_amount']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return OrderDetailSerializer
        if self.action == 'create':
            return CreateOrderSerializer
        return OrderSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # العملاء يرون طلباتهم فقط
        if not is_staff_user(self.request.user):
            qs = qs.filter(customer=self.request.user)
        return qs

    # ------------------------------------------------------------------
    # إنشاء طلب مع خصم المخزون داخل معاملة ذرّية
    # ✅ إصلاحات أمنية حرجة في هذه الدالة:
    #   1) قناة نقطة البيع (channel=pos) للموظفين فقط — منع العميل من إنشاء
    #      طلب مكتمل التسليم/الدفع بنفسه
    #   2) الخصم لموظفي النظام فقط وضمن سقف نسبي — منع إرسال خصم من العميل
    #   3) دفعات المتجر الإلكتروني لا تُسجل مكتملة عند الإنشاء مهما كانت
    #      الطريقة (لا بوابة دفع مدمجة) — الإكمال يتم بموافقة موظف/بوابة لاحقاً
    #   4) تجميع كميات المنتج الواحد المرسلة في عدة أسطر والتحقق من المجموع
    #      — منع تجاوز المخزون عبر تكرار المنتج نفسه في الطلب
    # ------------------------------------------------------------------
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        staff_request = is_staff_user(request.user)

        # (1) قناة نقطة البيع للموظفين حصراً
        channel = data.get('channel', 'online')
        if channel == 'pos' and not staff_request:
            return Response(
                {'detail': 'قناة نقطة البيع متاحة لموظفي النظام فقط'},
                status=status.HTTP_403_FORBIDDEN)

        # تحديد العميل: الموظف يحدد customer_id، والعميل هو نفسه
        customer_id = data.get('customer_id')
        if customer_id:
            if not staff_request:
                return Response({'detail': 'لا يمكنك إنشاء طلب لعميل آخر'},
                                status=status.HTTP_403_FORBIDDEN)
            try:
                customer = User.objects.get(id=customer_id)
            except User.DoesNotExist:
                return Response({'detail': 'العميل غير موجود'},
                                status=status.HTTP_400_BAD_REQUEST)
        else:
            customer = request.user

        # (4) تجميع الكميات لكل منتج — التحقق من إجمالي الكمية لا من كل سطر منفرداً
        qty_by_product = defaultdict(int)
        for item in data['items']:
            qty_by_product[item['product_id']] += item['quantity']

        # التحقق من توفر المنتجات وخصم الكميات (بأمان ضد التزامن عبر select_for_update)
        errors = []
        locked_products = {}
        for pid, total_qty in qty_by_product.items():
            try:
                product = Product.objects.select_for_update().get(
                    id=pid, is_active=True)
            except Product.DoesNotExist:
                errors.append({'product_id': pid, 'detail': 'المنتج غير موجود أو معطل'})
                continue
            if product.quantity < total_qty:
                errors.append({
                    'product_id': product.id,
                    'product_name': product.name,
                    'available': product.quantity,
                    'requested': total_qty,
                    'detail': 'إجمالي الكمية المطلوبة من هذا المنتج غير متوفرة'
                })
                continue
            locked_products[pid] = product
        if errors:
            return Response({'detail': 'تعذر إنشاء الطلب', 'errors': errors},
                            status=status.HTTP_400_BAD_REQUEST)

        # حساب الإجماليات من الأسعار الحالية للخادم (وليس من أسعار العميل)
        subtotal = Decimal('0')
        for pid, total_qty in qty_by_product.items():
            product = locked_products[pid]
            subtotal += product.price * total_qty

        # (2) الخصم: لموظفي النظام فقط وضمن سقف نسبي من المجموع
        discount = data.get('discount', Decimal('0'))
        if discount > 0:
            if not staff_request:
                return Response(
                    {'detail': 'الخصم يُطبق من موظفي النظام فقط — لا يمكن للعميل تحديد خصم'},
                    status=status.HTTP_403_FORBIDDEN)
            max_discount = (subtotal * Decimal(str(settings.TARAZ_MAX_DISCOUNT_RATIO)))
            if discount > max_discount:
                return Response(
                    {'detail': f"الخصم تجاوز الحد المسموح ({settings.TARAZ_MAX_DISCOUNT_RATIO * 100:.0f}% من قيمة الطلب)"},
                    status=status.HTTP_400_BAD_REQUEST)
        discount = min(discount, subtotal)
        after_discount = subtotal - discount
        tax = (after_discount * Decimal(str(settings.TARAZ_TAX_RATE))).quantize(Decimal('0.01'))

        # رسوم الشحن: نقطة البيع بلا شحن، والمتجر شحن ثابت مع إعفاء فوق حد معين
        shipping_fee = Decimal('0')
        if data.get('shipping_address'):
            shipping_fee = Decimal(str(settings.TARAZ_SHIPPING_FLAT))
            if subtotal >= Decimal(str(settings.TARAZ_FREE_SHIPPING_THRESHOLD)):
                shipping_fee = Decimal('0')

        final_amount = after_discount + tax + shipping_fee

        # ✅ إنشاء الطلب مع إعادة المحاولة عند تصادم الرقم النادر (P1):
        # قيد التفرد في قاعدة البيانات هو الضمانة الأخيرة، وهنا نلتقط
        # IntegrityError ونعيد المحاولة برقم جديد بدلاً من فشل الطلب.
        order = None
        for _attempt in range(3):
            try:
                order = Order.objects.create(
                    order_number=Order.generate_order_number(),
                    customer=customer,
                    created_by=request.user,
                    channel=channel,
                    discount=discount,
                    tax=tax,
                    shipping_fee=shipping_fee,
                    notes=data.get('notes', ''),
                    shipping_name=data.get('shipping_name', ''),
                    shipping_phone=data.get('shipping_phone', ''),
                    shipping_address=data.get('shipping_address', ''),
                    shipping_city=data.get('shipping_city', ''),
                )
                break
            except IntegrityError:
                if _attempt == 2:
                    raise
                continue

        # نقطة البيع: بيع حضوري أُنجز أمام الموظف — التسليم في نفس اللحظة
        is_pos = channel == 'pos'

        try:
            for pid, total_qty in qty_by_product.items():
                product = locked_products[pid]
                OrderItem.objects.create(
                    order=order, product=product,
                    quantity=total_qty, unit_price=product.price)
                # خصم المخزون + مزامنة سجل المخزون + تسجيل الحركة (تدقيق)
                # طبقة أمان أخيرة: لو سبق طلب متزامن وخصم الكمية، ترفض الخدمة
                # تجاوز الصفر بدل أي تضارب في المخزون
                apply_stock_change(
                    product_id=pid,
                    delta=-total_qty,
                    movement_type='out',
                    reference=order.order_number,
                    notes=f"بيع {'نقطة بيع' if is_pos else 'متجر إلكتروني'}",
                    user=request.user,
                )
        except ValueError as exc:
            # سباق متزامن على آخر وحدة — الخدمة منعت تجاوز المخزون
            transaction.set_rollback(True)
            return Response({'detail': f'نفدت الكمية أثناء تنفيذ الطلب: {exc}'},
                            status=status.HTTP_409_CONFLICT)

        order.total_amount = subtotal
        order.final_amount = final_amount
        # نقطة البيع: البضاعة سُلّمت وحُصّلت القيمة في نفس اللحظة أمام الموظف
        if is_pos:
            order.status = 'delivered'
        order.save(update_fields=['total_amount', 'final_amount', 'status', 'updated_at'])

        # (3) حالة الدفع عند الإنشاء:
        #   - نقطة البيع (بواسطة موظف): مكتمل — التحصيل مادي أمام الموظف
        #   - المتجر الإلكتروني: قيد الانتظار دائماً حتى إكمال موظف/بوابة الدفع —
        #     لا يوجد تكامل بوابة دفع فعلي، فتسجيلها مكتملة يزيّف الإيرادات المحصلة
        payment_status = 'completed' if is_pos else 'pending'
        Payment.objects.create(
            order=order,
            amount=final_amount,
            method=data.get('payment_method', 'cash'),
            status=payment_status,
            # معرف المعاملة مرجع داخلي لعمليات نقطة البيع فقط —
            # لا يُدّعى معرف معاملة بوابة دفع غير موجودة
            transaction_id=f"TRX-{order.order_number}" if is_pos else '',
            notes='' if is_pos else 'بانتظار تأكيد التحصيل من الإدارة أو بوابة الدفع',
        )

        # العمولة تُنشأ تلقائياً على كل طلب
        commission_amount = (final_amount * Decimal(str(settings.TARAZ_COMMISSION_RATE)) / 100).quantize(Decimal('0.01'))
        Commission.objects.create(
            order=order,
            amount=commission_amount,
            percentage=Decimal(str(settings.TARAZ_COMMISSION_RATE)),
        )

        return Response(OrderDetailSerializer(order).data, status=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # إدارة حالة الطلب مع التحقق من المسار القانوني
    # ✅ إصلاح أمني: انتقالات الحالة (تأكيد/شحن/تسليم) لموظفي النظام فقط —
    # كان العميل يستطيع تسليم طلبه بنفسه عبر هذه المسارات
    # ------------------------------------------------------------------
    def _transition(self, request, pk, new_status, success_msg, staff_only=False):
        if staff_only and not is_staff_user(request.user):
            return Response(
                {'detail': 'إدارة حالة الطلب متاحة لموظفي النظام فقط'},
                status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        if not order.can_transition(new_status):
            return Response(
                {'detail': f'لا يمكن نقل الطلب من حالة ({order.get_status_display()}) إلى ({dict(Order.STATUS_CHOICES)[new_status]})'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if new_status == 'cancelled':
            with transaction.atomic():
                order.restock_items(user=request.user)
                order.status = 'cancelled'
                order.save(update_fields=['status', 'updated_at'])
                # إلغاء الدفع والعمولة إن وجدا
                if hasattr(order, 'payment') and order.payment.status == 'completed':
                    order.payment.status = 'refunded'
                    order.payment.save(update_fields=['status', 'updated_at'])
        else:
            order.status = new_status
            order.save(update_fields=['status', 'updated_at'])
            # عند التسليم تُحتسب العمولة النهائية
            if new_status == 'delivered' and hasattr(order, 'commission'):
                order.commission.status = 'pending'
                order.commission.save(update_fields=['status'])
        return Response(OrderDetailSerializer(order).data)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        return self._transition(request, pk, 'confirmed', 'تم تأكيد الطلب', staff_only=True)

    @action(detail=True, methods=['post'])
    def ship(self, request, pk=None):
        return self._transition(request, pk, 'shipped', 'تم شحن الطلب', staff_only=True)

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        return self._transition(request, pk, 'delivered', 'تم تسليم الطلب', staff_only=True)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """إلغاء الطلب مع إرجاع الكميات للمخزون — العميل يلغي المعلق فقط"""
        # العميل يلغي طلباته المعلقة فقط — الموظف يلغي أي طلب
        if not is_staff_user(request.user):
            order = self.get_object()
            if order.status != 'pending':
                return Response(
                    {'detail': 'يمكن إلغاء الطلبات قيد الانتظار فقط. تواصل مع خدمة العملاء.'},
                    status=status.HTTP_400_BAD_REQUEST)
        return self._transition(request, pk, 'cancelled', 'تم إلغاء الطلب')

    @action(detail=False, methods=['get'])
    def my_orders(self, request):
        """طلباتي — للعميل الحالي (مرقّمة صفحاتياً ✅ P1)"""
        orders = Order.objects.filter(customer=request.user).prefetch_related('items__product')
        page = self.paginate_queryset(orders)
        if page is not None:
            serializer = OrderSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    # ✅ الفاتورة الإلكترونية المبسطة (امتثال ZATCA — المرحلة الأولى):
    # بيانات الفاتورة + رمز QR بترميز TLV (اسم البائع، الرقم الضريبي،
    # الطابع الزمني، الإجمالي مع الضريبة، ضريبة القيمة المضافة).
    # الوصول: صاحب الطلب أو موظفو النظام فقط.
    # ------------------------------------------------------------------
    @action(detail=True, methods=['get'])
    def invoice(self, request, pk=None):
        order = self.get_object()  # يفرض صلاحية الوصول (صاحب الطلب/موظف)

        invoice_number = f"INV-{order.order_number}"
        issued_at = order.created_at.astimezone()

        # إنشاء رمز QR وفق مواصفة ZATCA TLV
        qr = build_invoice_qr(
            seller_name=settings.TARAZ_SELLER_NAME,
            vat_number=settings.TARAZ_VAT_NUMBER,
            issued_at=issued_at,
            invoice_total=order.final_amount,
            vat_total=order.tax,
        )

        items_data = [{
            'name': item.product.name,
            'sku': item.product.sku,
            'quantity': item.quantity,
            'unit_price': str(item.unit_price),
            'subtotal': str(item.subtotal),
        } for item in order.items.select_related('product')]

        return Response({
            'invoice_number': invoice_number,
            'order_number': order.order_number,
            'channel': order.channel,
            'channel_display': order.get_channel_display(),
            'status': order.status,
            'status_display': order.get_status_display(),
            'issued_at': issued_at.isoformat(),
            'seller': {
                'name': settings.TARAZ_SELLER_NAME,
                'vat_number': settings.TARAZ_VAT_NUMBER,
            },
            'customer': {
                'name': order.shipping_name or order.customer.get_full_name() or order.customer.username,
                'phone': order.shipping_phone,
                'address': f"{order.shipping_city} — {order.shipping_address}".strip(' —'),
            },
            'items': items_data,
            'totals': {
                'subtotal': str(order.total_amount),
                'discount': str(order.discount),
                'tax': str(order.tax),
                'tax_rate': settings.TARAZ_TAX_RATE,
                'shipping_fee': str(order.shipping_fee),
                'final_amount': str(order.final_amount),
            },
            'payment': ({
                'method': order.payment.method,
                'method_display': order.payment.get_method_display(),
                'status': order.payment.status,
                'status_display': order.payment.get_status_display(),
                'transaction_id': order.payment.transaction_id,
            } if hasattr(order, 'payment') else None),
            'zatca': {
                **qr,
                'spec': 'E-Invoice (Simplified) — TLV Base64 QR',
            },
        })

    # ------------------------------------------------------------------
    # ✅ الدفع الإلكتروني بالبطاقة (بوابة مويسر / وضع المحاكاة):
    #   POST /api/orders/{id}/pay/          → إنشاء جلسة دفع
    #   POST /api/orders/{id}/pay/confirm/  → تأكيد الدفع (تحقق خلفي)
    # المتاح لصاحب الطلب فقط، ولطلبات المتجر ذات دفعة قيد الانتظار.
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        order = self.get_object()

        # صاحب الطلب فقط (الموظفون يحصّلون عبر نقطة البيع أو إكمال الدفعة)
        if order.customer_id != request.user.id and not is_staff_user(request.user):
            return Response({'detail': 'لا يمكنك دفع هذا الطلب'},
                            status=status.HTTP_403_FORBIDDEN)
        if not hasattr(order, 'payment'):
            return Response({'detail': 'لا توجد دفعة مرتبطة بهذا الطلب'},
                            status=status.HTTP_400_BAD_REQUEST)
        if order.payment.status == 'completed':
            return Response({'detail': 'هذا الطلب مدفوع مسبقاً'},
                            status=status.HTTP_400_BAD_REQUEST)
        if order.status == 'cancelled':
            return Response({'detail': 'هذا الطلب ملغي — لا يمكن دفعه'},
                            status=status.HTTP_400_BAD_REQUEST)

        provider = get_provider()
        try:
            session = provider.create_session(order, order.final_amount)
        except PaymentError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # تسجيل الجلسة في الدفعة (transaction_id) — مرجع التأكيد لاحقاً
        order.payment.transaction_id = session['session_id']
        order.payment.save(update_fields=['transaction_id', 'updated_at'])

        return Response({
            'order': order.id,
            'order_number': order.order_number,
            'amount': str(order.final_amount),
            'currency': 'SAR',
            **{k: v for k, v in session.items() if k != 'session_id'},
            'session_id': session['session_id'],
        })

    @action(detail=True, methods=['post'], url_path='pay/confirm')
    @transaction.atomic
    def pay_confirm(self, request, pk=None):
        order = self.get_object()

        if order.customer_id != request.user.id and not is_staff_user(request.user):
            return Response({'detail': 'لا يمكنك تأكيد دفع هذا الطلب'},
                            status=status.HTTP_403_FORBIDDEN)
        if not hasattr(order, 'payment'):
            return Response({'detail': 'لا توجد دفعة مرتبطة بهذا الطلب'},
                            status=status.HTTP_400_BAD_REQUEST)

        payment = order.payment
        session_id = request.data.get('session_id', '')
        if not session_id or session_id != payment.transaction_id:
            return Response({'detail': 'جلسة الدفع غير مطابقة لهذا الطلب'},
                            status=status.HTTP_400_BAD_REQUEST)
        if payment.status == 'completed':
            return Response({'detail': 'هذا الطلب مدفوع مسبقاً'},
                            status=status.HTTP_400_BAD_REQUEST)

        provider = get_provider()
        try:
            result = provider.confirm_session(order, session_id, {
                'number': request.data.get('card_number', ''),
                'expiry': request.data.get('card_expiry', ''),
                'cvv': request.data.get('card_cvv', ''),
                'name': request.data.get('card_name', ''),
            })
        except PaymentError as exc:
            # تسجيل المحاولة الفاشلة على الدفعة (أثر تدقيق) دون بيانات البطاقة
            payment.status = 'failed'
            payment.save(update_fields=['status', 'updated_at'])
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # ✅ التحقق الخلفي نجح — تحصيل فعلي للدفعة وتأكيد الطلب
        payment.status = 'completed'
        payment.transaction_id = result.get('reference') or session_id
        payment.notes = f"دفع إلكتروني عبر {result.get('provider', provider.slug)}"
        payment.save(update_fields=['status', 'transaction_id', 'notes', 'updated_at'])

        if order.status == 'pending':
            order.status = 'confirmed'
            order.save(update_fields=['status', 'updated_at'])

        return Response({
            'detail': 'تم الدفع بنجاح',
            'order_number': order.order_number,
            'payment_status': 'completed',
            'order_status': order.status,
            'reference': payment.transaction_id,
        })

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """إحصائيات الطلبات — للموظفين"""
        if not is_staff_user(request.user):
            return Response({'detail': 'هذه الإحصائيات متاحة لموظفي النظام فقط'},
                            status=status.HTTP_403_FORBIDDEN)
        now = timezone.localtime()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total_revenue = Order.objects.exclude(status='cancelled').aggregate(
            v=Sum('final_amount'))['v'] or Decimal('0')
        today_revenue = Order.objects.filter(
            created_at__gte=today_start).exclude(status='cancelled').aggregate(
            v=Sum('final_amount'))['v'] or Decimal('0')
        month_revenue = Order.objects.filter(
            created_at__gte=month_start).exclude(status='cancelled').aggregate(
            v=Sum('final_amount'))['v'] or Decimal('0')

        # ✅ دقة الإيرادات المحاسبية (P1): فصل المحصّل فعلياً عن قيمة الطلبات —
        # الإيراد المحصّل = طلبات غير ملغاة مرتبطة بدفعة مكتملة فقط
        collected_revenue = Order.objects.exclude(status='cancelled').filter(
            payment__status='completed').aggregate(
            v=Sum('final_amount'))['v'] or Decimal('0')
        collected_today = Order.objects.filter(
            created_at__gte=today_start).exclude(status='cancelled').filter(
            payment__status='completed').aggregate(
            v=Sum('final_amount'))['v'] or Decimal('0')
        collected_month = Order.objects.filter(
            created_at__gte=month_start).exclude(status='cancelled').filter(
            payment__status='completed').aggregate(
            v=Sum('final_amount'))['v'] or Decimal('0')

        return Response({
            'total_orders': Order.objects.count(),
            'pending_orders': Order.objects.filter(status='pending').count(),
            'confirmed_orders': Order.objects.filter(status='confirmed').count(),
            'shipped_orders': Order.objects.filter(status='shipped').count(),
            'delivered_orders': Order.objects.filter(status='delivered').count(),
            'cancelled_orders': Order.objects.filter(status='cancelled').count(),
            'total_revenue': total_revenue,
            'today_revenue': today_revenue,
            'month_revenue': month_revenue,
            # الإيرادات المحصلة فعلياً — أساس المحاسبة
            'collected_revenue': collected_revenue,
            'collected_today': collected_today,
            'collected_month': collected_month,
            # قيمة الطلبات غير المحصلة بعد (معلقة/تحويل بانتظار تأكيد)
            'outstanding_revenue': total_revenue - collected_revenue,
        })


class PaymentViewSet(viewsets.ModelViewSet):
    """إدارة الدفعات — للموظفين"""
    queryset = Payment.objects.select_related('order').all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsStaff]
    filterset_fields = ['status', 'method']
    ordering = ['-created_at']

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def complete(self, request, pk=None):
        """إكمال الدفع + تأكيد الطلب + تفعيل العمولة"""
        payment = self.get_object()
        if payment.status == 'completed':
            return Response({'detail': 'هذه الدفعة مكتملة مسبقاً'}, status=status.HTTP_400_BAD_REQUEST)
        if payment.status == 'refunded':
            return Response({'detail': 'لا يمكن إكمال دفعة مسترجعة'}, status=status.HTTP_400_BAD_REQUEST)

        payment.status = 'completed'
        payment.transaction_id = payment.transaction_id or f"TRX-{payment.order.order_number}"
        payment.save(update_fields=['status', 'transaction_id', 'updated_at'])

        order = payment.order
        if order.status == 'pending':
            order.status = 'confirmed'
            order.save(update_fields=['status', 'updated_at'])
        return Response(PaymentSerializer(payment).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def refund(self, request, pk=None):
        """استرجاع الدفع + إلغاء الطلب + إرجاع المخزون"""
        payment = self.get_object()
        if payment.status != 'completed':
            return Response({'detail': 'يمكن استرجاع الدفعات المكتملة فقط'},
                            status=status.HTTP_400_BAD_REQUEST)

        payment.status = 'refunded'
        payment.save(update_fields=['status', 'updated_at'])

        order = payment.order
        if order.status != 'cancelled':
            order.restock_items(user=request.user)
            order.status = 'cancelled'
            order.save(update_fields=['status', 'updated_at'])
        return Response(PaymentSerializer(payment).data)


class CommissionViewSet(viewsets.ModelViewSet):
    """إدارة العمولات — للمشرف والمدير"""
    queryset = Commission.objects.select_related('order').all()
    serializer_class = CommissionSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    filterset_fields = ['status']
    ordering = ['-created_at']

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        commission = self.get_object()
        if commission.status == 'paid':
            return Response({'detail': 'العمولة مدفوعة مسبقاً'}, status=status.HTTP_400_BAD_REQUEST)
        commission.status = 'paid'
        commission.paid_at = timezone.now()
        commission.save(update_fields=['status', 'paid_at'])
        return Response(CommissionSerializer(commission).data)

    @action(detail=False, methods=['get'])
    def pending_commissions(self, request):
        commissions = Commission.objects.filter(status='pending').select_related('order')
        total = commissions.aggregate(v=Sum('amount'))['v'] or Decimal('0')
        serializer = CommissionSerializer(commissions, many=True)
        return Response({
            'total_pending': total,
            'count': commissions.count(),
            'commissions': serializer.data
        })

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """ملخص العمولات"""
        total = Commission.objects.aggregate(v=Sum('amount'))['v'] or Decimal('0')
        paid = Commission.objects.filter(status='paid').aggregate(v=Sum('amount'))['v'] or Decimal('0')
        pending = Commission.objects.filter(status='pending').aggregate(v=Sum('amount'))['v'] or Decimal('0')
        return Response({
            'total': total,
            'paid': paid,
            'pending': pending,
        })


class DashboardStatsView(APIView):
    """
    إحصائيات لوحة التحكم — لتطبيق سطح المكتب:
    مؤشرات اليوم/الشهر + مبيعات 30 يوماً + أفضل المنتجات + أحدث الطلبات
    """
    permission_classes = [IsAuthenticated, IsStaff]

    def get(self, request):
        now = timezone.localtime()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        orders_qs = Order.objects.exclude(status='cancelled')

        # المؤشرات الرئيسية
        today_revenue = orders_qs.filter(created_at__gte=today_start).aggregate(v=Sum('final_amount'))['v'] or Decimal('0')
        month_revenue = orders_qs.filter(created_at__gte=month_start).aggregate(v=Sum('final_amount'))['v'] or Decimal('0')
        total_revenue = orders_qs.aggregate(v=Sum('final_amount'))['v'] or Decimal('0')
        # ✅ دقة الإيرادات (P1): المحصّل فعلياً = طلبات مرتبطة بدفعة مكتملة
        collected_revenue = orders_qs.filter(payment__status='completed').aggregate(
            v=Sum('final_amount'))['v'] or Decimal('0')
        collected_month = orders_qs.filter(
            created_at__gte=month_start, payment__status='completed').aggregate(
            v=Sum('final_amount'))['v'] or Decimal('0')
        total_orders = Order.objects.count()
        today_orders = Order.objects.filter(created_at__gte=today_start).count()
        pending_orders = Order.objects.filter(status='pending').count()

        # المخزون
        products_count = Product.objects.filter(is_active=True).count()
        low_stock_count = Product.objects.filter(quantity__lt=F('min_quantity')).count()
        out_of_stock_count = Product.objects.filter(quantity__lte=0).count()
        inventory_value = Product.objects.aggregate(
            v=Sum(F('quantity') * F('cost'), output_field=models.DecimalField()))['v'] or Decimal('0')

        # العملاء
        customers_count = User.objects.filter(role='customer').count()

        # ✅ مبيعات آخر 30 يوماً (P1): استعلام تجميع واحد حسب التاريخ بدل
        # حلقة من 60 استعلاماً (2 لكل يوم) — التعبئة بالأيام الفارغة في بايثون
        thirty_start = (now - timedelta(days=29)).replace(
            hour=0, minute=0, second=0, microsecond=0)
        daily_map = {}
        daily_rows = (
            orders_qs.filter(created_at__gte=thirty_start)
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(revenue=Sum('final_amount'), count=Count('id'))
        )
        for row in daily_rows:
            daily_map[row['date'].strftime('%Y-%m-%d')] = row

        sales_by_day = []
        for i in range(29, -1, -1):
            day = (now - timedelta(days=i)).replace(
                hour=0, minute=0, second=0, microsecond=0)
            key = day.strftime('%Y-%m-%d')
            row = daily_map.get(key)
            sales_by_day.append({
                'date': key,
                'label': day.strftime('%d/%m'),
                'revenue': float(row['revenue']) if row and row['revenue'] else 0.0,
                'orders': row['count'] if row else 0,
            })

        # أفضل المنتجات مبيعاً
        top_products = (
            OrderItem.objects.filter(order__status__in=['confirmed', 'shipped', 'delivered'])
            .values('product__id', 'product__name', 'product__sku')
            .annotate(
                total_qty=Sum('quantity'),
                total_sales=Sum('subtotal'),
            )
            .order_by('-total_sales')[:5]
        )
        top_products_data = [
            {
                'id': p['product__id'],
                'name': p['product__name'],
                'sku': p['product__sku'],
                'total_quantity': p['total_qty'],
                'total_sales': float(p['total_sales']),
            } for p in top_products
        ]

        # أحدث الطلبات
        recent_orders = Order.objects.select_related('customer').order_by('-created_at')[:5]
        recent_orders_data = OrderSerializer(recent_orders, many=True).data

        return Response({
            'generated_at': now.isoformat(),
            'revenue': {
                'today': float(today_revenue),
                'month': float(month_revenue),
                'total': float(total_revenue),
                # ✅ الإيراد المحصّل فعلياً (دفوعات مكتملة) مقابل قيمة الطلبات
                'collected_total': float(collected_revenue),
                'collected_month': float(collected_month),
                'outstanding': float(total_revenue - collected_revenue),
            },
            'orders': {
                'total': total_orders,
                'today': today_orders,
                'pending': pending_orders,
            },
            'inventory': {
                'products': products_count,
                'low_stock': low_stock_count,
                'out_of_stock': out_of_stock_count,
                'value': float(inventory_value),
            },
            'customers': {
                'total': customers_count,
            },
            'sales_by_day': sales_by_day,
            'top_products': top_products_data,
            'recent_orders': recent_orders_data,
        })
