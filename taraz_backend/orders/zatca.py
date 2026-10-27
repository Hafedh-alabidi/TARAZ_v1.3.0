"""
✅ امتثال هيئة الزكاة والضريبة والجمارك (ZATCA) — الفاتورة الإلكترونية المبسطة:

المرحلة الأولى (المرحلة المبسطة/التقليدية) تتطلب إظهار رمز QR في الفاتورة
المبسطة (B2C) يحتوي بيانات البائع والمبلغ والضريبة بترميز TLV وفق المواصفة:

  الوسم 1: اسم البائع
  الوسم 2: الرقم الضريبي للبائع
  الوسم 3: الطابع الزمني للفاتورة (ISO 8601)
  الوسم 4: إجمالي الفاتورة (مع الضريبة)
  الوسم 5: إجمالي ضريبة القيمة المضافة

صيغة الوسم: [رقم الوسم (بايت واحد)] [طول القيمة (بايت واحد)] [القيمة (UTF-8)]
ثم يُرمَّز المجموع بـ Base64 ويُعرض كرمز QR على الفاتورة.
"""
import base64
import io
from datetime import datetime
from decimal import Decimal

import qrcode

# وسوم ZATCA المعتمدة في المواصفة
TAG_SELLER_NAME = 1
TAG_VAT_NUMBER = 2
TAG_TIMESTAMP = 3
TAG_INVOICE_TOTAL = 4
TAG_VAT_TOTAL = 5


def _tlv(tag: int, value: str) -> bytes:
    """ترميز حقل واحد بصيغة Tag-Length-Value."""
    encoded = value.encode('utf-8')
    if len(encoded) > 255:
        raise ValueError('قيمة الوسم أطول من الحد المسموح (255 بايت)')
    return bytes([tag, len(encoded)]) + encoded


def build_tlv_payload(seller_name: str, vat_number: str,
                      timestamp: str, invoice_total: Decimal,
                      vat_total: Decimal) -> str:
    """
    بناء حمولة QR بصيغة TLV ثم ترميزها Base64 — كما تتطلبه مواصفة ZATCA.
    """
    # توحيد صيغة الأرقام: نقطتان عشريتان (المواصفة تقبل القيمة العشرية)
    total_str = f"{invoice_total:.2f}"
    vat_str = f"{vat_total:.2f}"

    payload = b''.join([
        _tlv(TAG_SELLER_NAME, seller_name),
        _tlv(TAG_VAT_NUMBER, vat_number),
        _tlv(TAG_TIMESTAMP, timestamp),
        _tlv(TAG_INVOICE_TOTAL, total_str),
        _tlv(TAG_VAT_TOTAL, vat_str),
    ])
    return base64.b64encode(payload).decode('ascii')


def generate_qr_png_base64(tlv_payload_b64: str) -> str:
    """
    توليد صورة QR (PNG) بصيغة Base64 Data URI — جاهزة للعرض المباشر في
    الواجهات وفي الطباعة، دون الحاجة لتخزين ملفات على القرص.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(tlv_payload_b64)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    b64 = base64.b64encode(buffer.getvalue()).decode('ascii')
    return f"data:image/png;base64,{b64}"


def build_invoice_qr(seller_name: str, vat_number: str,
                     issued_at: datetime, invoice_total: Decimal,
                     vat_total: Decimal) -> dict:
    """
    بناء رمز QR الكامل للفاتورة المبسطة:
    يعيد الحمولة (Base64 TLV) + صورة QR (Data URI) + الطابع الزمني ISO 8601.
    """
    # ISO 8601 مع المنطقة الزمنية — مثال: 2026-04-13T15:30:00+03:00
    ts = issued_at.isoformat()
    payload = build_tlv_payload(seller_name, vat_number, ts,
                                invoice_total, vat_total)
    return {
        'tlv_base64': payload,
        'qr_png': generate_qr_png_base64(payload),
        'timestamp': ts,
    }
