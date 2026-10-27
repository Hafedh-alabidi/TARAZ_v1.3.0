"""
✅ بوابة الدفع الإلكتروني — طبقة تجريد موحّدة:

  - MoyasarProvider   : تكامل حقيقي مع بوابة مويسر (Moyasar) السعودية
                        (جيب / Visa / Mastercard / Apple Pay).
  - SimulatedProvider : بوابة محاكاة كاملة لبيئات التدريب والاختبار والقبول —
                        تقبل بطاقات تجريبية معروفة فقط وترفض غيرها،
                        ولا تلمس أي شبكة خارجية.

الاختيار عبر TARAZ_PAYMENT_PROVIDER في الإعدادات:
  'moyasar' | 'simulated' | 'none'

الأمان:
  - إنشاء جلسة الدفع لا يتم إلا لطلب قائم لصاحبه وبدفعة قيد الانتظار.
  - التأكيد يتحقق من ملكية الجلسة للطلب نفسه (منع إعادة استخدام الجلسة).
  - أرقام البطاقات لا تُخزن إطلاقاً — لا في السجلات ولا في قاعدة البيانات.
"""
import base64
import json
import secrets
import urllib.request
import urllib.error
from decimal import Decimal

from django.conf import settings


class PaymentError(Exception):
    """خطأ عام في بوابة الدفع — رسالة آمنة للعرض على العميل."""


# ----------------------------------------------------------------------
# بطاقات المحاكاة التجريبية (وضع simulated فقط) — لأغراض الاختبار والقبول
# ----------------------------------------------------------------------
SIMULATED_TEST_CARDS = {
    '4111111111111111': ('جيب/Visa تجريبية', 'approved'),
    '4222222222222222': ('بطاقة تجريبية — رصيد غير كافٍ', 'declined'),
    '5555555555554444': ('Mastercard تجريبية', 'approved'),
}
SIMULATED_SESSION_PREFIX = 'SIM-'


class BaseProvider:
    """واجهة موحدة لمزودي الدفع."""

    slug = 'none'
    requires_redirect = False

    def create_session(self, order, amount: Decimal) -> dict:
        raise NotImplementedError

    def confirm_session(self, order, session_id: str, card: dict) -> dict:
        raise NotImplementedError


class SimulatedProvider(BaseProvider):
    """
    بوابة محاكاة محلية — سلوك مطابق للواقع دون أي اتصال خارجي.

    الفائدة: تدريب الكاشيرين، اختبارات القبول (UAT)، والمعاينة قبل
    ربط مفاتيح مويسر الحقيقية. الجلسة تُخزن في transaction_id للدفعة.
    """
    slug = 'simulated'

    def create_session(self, order, amount: Decimal) -> dict:
        session_id = f"{SIMULATED_SESSION_PREFIX}{secrets.token_hex(12)}"
        return {
            'session_id': session_id,
            'provider': self.slug,
            'amount': str(amount),
            'mode': 'simulated',
            'test_cards': [
                {'number': '4111111111111111', 'result': 'approved', 'label': 'جيب/Visa — عملية ناجحة'},
                {'number': '4222222222222222', 'result': 'declined', 'label': 'بطاقة — رصيد غير كافٍ'},
            ],
        }

    def confirm_session(self, order, session_id: str, card: dict) -> dict:
        if not session_id.startswith(SIMULATED_SESSION_PREFIX):
            raise PaymentError('معرف جلسة غير صالح')
        number = (card.get('number') or '').replace(' ', '').replace('-', '')
        if number not in SIMULATED_TEST_CARDS:
            raise PaymentError('رقم البطاقة غير مدعوم في وضع المحاكاة — استخدم إحدى البطاقات التجريبية')
        label, outcome = SIMULATED_TEST_CARDS[number]
        if outcome != 'approved':
            raise PaymentError(f'رفضت بوابة المحاكاة العملية: {label}')
        # انتهاء صلاحية أساسي (MM/YY) — تحقق شكلي دون تخزين
        expiry = (card.get('expiry') or '').strip()
        if len(expiry) != 5 or expiry[2] != '/':
            raise PaymentError('تاريخ انتهاء الصلاحية غير صحيح (MM/YY)')
        cvv = (card.get('cvv') or '').strip()
        if not (len(cvv) == 3 and cvv.isdigit()):
            raise PaymentError('رمز التحقق CVV غير صحيح')
        return {
            'status': 'approved',
            'provider': self.slug,
            'reference': f"SIMTRX-{secrets.token_hex(6).upper()}",
        }


class MoyasarProvider(BaseProvider):
    """
    تكامل بوابة مويسر الحقيقية — إنشاء دفعة ثم التحقق من حالتها.

    يتطلب MOYASAR_SECRET_KEY في متغيرات البيئة. الاستخدام الفعلي يتم عبر
    صفحة الدفع المستضافة عند مويسر (Hosted Payment Page) ثم التحقق الخلفي
    من حالة الدفعة عند العودة — لا تُقبل نتيجة العميل وحدها أبداً.
    """
    slug = 'moyasar'
    API_BASE = 'https://api.moyasar.com/v1'
    requires_redirect = True

    def _auth_header(self) -> str:
        key = settings.MOYASAR_SECRET_KEY
        if not key:
            raise PaymentError('بوابة مويسر غير مهيأة — أضف MOYASAR_SECRET_KEY')
        return 'Basic ' + base64.b64encode(f'{key}:'.encode()).decode('ascii')

    def _request(self, method: str, path: str, payload: dict | None = None) -> dict:
        url = f'{self.API_BASE}{path}'
        data = json.dumps(payload).encode('utf-8') if payload else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header('Authorization', self._auth_header())
        req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as exc:
            try:
                err = json.loads(exc.read().decode('utf-8'))
                message = err.get('message', 'خطأ من بوابة الدفع')
            except Exception:
                message = f'خطأ اتصال ببوابة الدفع ({exc.code})'
            raise PaymentError(message) from exc
        except urllib.error.URLError as exc:
            raise PaymentError('تعذر الوصول إلى بوابة الدفع — حاول مجدداً') from exc

    def create_session(self, order, amount: Decimal) -> dict:
        """إنشاء دفعة لدى مويسر وإرجاع رابط صفحة الدفع المستضافة."""
        # حساب المبالغ: مويسر يتعامل بالهللات (أصغر وحدة نقدية)
        amount_hal = int((amount * 100).quantize(Decimal('1')))
        callback_url = f"{settings.FRONTEND_URL}/orders/{order.id}/payment-callback"
        result = self._request('POST', '/payments', {
            'amount': amount_hal,
            'currency': 'SAR',
            'description': f'طلب {order.order_number} — متجر طراز',
            'callback_url': callback_url,
            'source': {'type': 'creditcard'},
            'metadata': {'order_number': order.order_number, 'order_id': str(order.id)},
        })
        return {
            'session_id': result.get('id', ''),
            'provider': self.slug,
            'amount': str(amount),
            'mode': 'live',
            'payment_url': result.get('source', {}).get('transaction_url', ''),
        }

    def confirm_session(self, order, session_id: str, card: dict) -> dict:
        """التحقق الخلفي من حالة الدفعة لدى مويسر (مصدر الحقيقة)."""
        result = self._request('GET', f'/payments/{session_id}')
        status = result.get('status')
        if status == 'paid':
            return {
                'status': 'approved',
                'provider': self.slug,
                'reference': result.get('id', ''),
            }
        raise PaymentError(f'حالة الدفعة لدى البوابة: {status or "غير معروفة"} — لم تُحصّل المبلغ')


class NoneProvider(BaseProvider):
    """لا بوابة دفع إلكتروني — الدفع عند الاستلام/تحويل بنكي فقط."""
    slug = 'none'

    def create_session(self, order, amount: Decimal) -> dict:
        raise PaymentError('الدفع الإلكتروني غير مفعل حالياً')

    def confirm_session(self, order, session_id: str, card: dict) -> dict:
        raise PaymentError('الدفع الإلكتروني غير مفعل حالياً')


def get_provider() -> BaseProvider:
    """إرجاع مزود الدفع المفعّل من الإعدادات."""
    providers = {
        'moyasar': MoyasarProvider,
        'simulated': SimulatedProvider,
        'none': NoneProvider,
    }
    cls = providers.get(settings.TARAZ_PAYMENT_PROVIDER, NoneProvider)
    return cls()
