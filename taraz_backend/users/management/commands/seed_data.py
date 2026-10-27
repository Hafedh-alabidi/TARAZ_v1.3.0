"""
تهيئة بيانات تجريبية واقعية لنظام طراز.
Usage: python manage.py seed_data [--flush]

✅ أمن: في الإنتاج (DEBUG=False) يرفض الأمر إنشاء الحسابات التجريبية
بكلمات مرور ثابتة معروفة، إلا بتمرير --force-demo الصريح — وحينها
تُولّد كلمات مرور عشوائية تُطبع مرة واحدة ولا تُخزّن في أي مكان.
"""
import random
import string
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.conf import settings

from inventory.models import Category, Supplier, Product, Inventory
from orders.models import Order, OrderItem, Payment, Commission

User = get_user_model()

CATEGORIES = [
    ('إلكترونيات', 'أجهزة وملحقات إلكترونية', 'electronics'),
    ('ملابس', 'أزياء رجالية ونسائية', 'fashion'),
    ('أطعمة ومشروبات', 'منتجات غذائية', 'food'),
    ('منزل ومطبخ', 'أدوات منزلية', 'home'),
    ('رياضة ولياقة', 'مستلزمات رياضية', 'sports'),
]

SUPPLIERS = [
    ('مؤسسة السعيد للتوريدات', 'info@alsaed-ye.com', '777123456', 'صنعاء', 'اليمن'),
    ('شركة النور للتجارة', 'sales@alnoor-ye.com', '737987654', 'عدن', 'اليمن'),
    ('Global Traders', 'contact@globaltraders.com', '712555555', 'الحديدة', 'اليمن'),
]

PRODUCTS = [
    ('هاتف ذكي X-Pro 256GB', 'إلكترونيات', 3499, 2600, 45, 10),
    ('سماعات لاسلكية Premium', 'إلكترونيات', 599, 320, 120, 25),
    ('ساعة ذكية Sport', 'إلكترونيات', 899, 550, 60, 15),
    ('شاحن سريع 65W', 'إلكترونيات', 149, 65, 200, 50),
    ('قملة صوف رجالية', 'ملابس', 289, 140, 80, 20),
    ('قميص قطني كلاسيك', 'ملابس', 149, 60, 150, 30),
    ('حقيبة ظهر عملية', 'ملابس', 249, 110, 90, 20),
    ('قهوة عربية فاخرة 500g', 'أطعمة ومشروبات', 89, 42, 300, 60),
    ('عسل سدر طبيعي 1KG', 'أطعمة ومشروبات', 320, 190, 40, 10),
    ('تمر مجدول ممتاز 3KG', 'أطعمة ومشروبات', 145, 78, 8, 15),
    ('طقم أواني طهي 10 قطع', 'منزل ومطبخ', 549, 300, 35, 10),
    ('خلاط كهربائي 1200W', 'منزل ومطبخ', 399, 230, 50, 12),
    ('دمبل قابل للتعديل 20KG', 'رياضة ولياقة', 459, 270, 25, 8),
    ('سجادة يوغا احترافية', 'رياضة ولياقة', 129, 55, 110, 25),
]

CUSTOMERS = [
    ('ahmad', 'ahmad@example.com', 'أحمد', 'المطري'),
    ('sara', 'sara@example.com', 'سارة', 'الحمادي'),
    ('mohammed', 'mohammed@example.com', 'محمد', 'الشدادي'),
    ('nora', 'nora@example.com', 'نورة', 'العرشي'),
    ('khalid', 'khalid@example.com', 'خالد', 'الحيمي'),
]

STAFF_PASSWORDS = {
    'admin': 'Admin@2026',
    'manager1': 'Manager@2026',
    'employee1': 'Employee@2026',
}


class Command(BaseCommand):
    help = 'تهيئة بيانات تجريبية واقعية (فئات، موردون، منتجات، عملاء، طلبات)'

    def add_arguments(self, parser):
        parser.add_argument('--flush', action='store_true',
                            help='حذف البيانات التجريبية الحالية قبل الإنشاء')
        parser.add_argument('--force-demo', action='store_true',
                            help='تجاوز حماية الإنتاج (غير مستحسن) — يولّد كلمات مرور عشوائية')

    def handle(self, *args, **options):
        # ✅ أمن: منع إنشاء حسابات معروفة مسبقاً في بيئة الإنتاج
        self.in_production = not settings.DEBUG
        self.force_demo = options['force_demo']
        if self.in_production and not self.force_demo:
            raise CommandError(
                'هذا أمر بيانات تطويرية و DEBUG=False (إنتاج). \n'
                'إنشاء حسابات بكلمات مرور ثابتة في الإنتاج ثغرة أمنية مباشرة.\n'
                'للبيانات التجريبية في بيئة اختبار: شغّل مع DEBUG=True،\n'
                'أو مرّر --force-demo لتوليد كلمات مرور عشوائية تُطبع مرة واحدة.'
            )

        if options['flush']:
            self.stdout.write('حذف البيانات القديمة...')
            Payment.objects.all().delete()
            Commission.objects.all().delete()
            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            Inventory.objects.all().delete()
            Product.objects.all().delete()
            Category.objects.all().delete()
            Supplier.objects.all().delete()
            User.objects.filter(role='customer').delete()
            User.objects.filter(username__in=list(STAFF_PASSWORDS)).delete()
            self.stdout.write(self.style.SUCCESS('تم الحذف'))

        self.stdout.write('إنشاء الفئات...')
        cat_map = {}
        for name, desc, icon in CATEGORIES:
            cat, _ = Category.objects.get_or_create(
                name=name, defaults={'description': desc, 'icon': icon})
            cat_map[name] = cat

        self.stdout.write('إنشاء الموردين...')
        sup_list = []
        for name, email, phone, city, country in SUPPLIERS:
            sup, _ = Supplier.objects.get_or_create(name=name, defaults={
                'email': email, 'phone': phone,
                'address': f'شارع الملك فهد، {city}',
                'city': city, 'country': country})
            sup_list.append(sup)

        self.stdout.write('إنشاء المنتجات...')
        products = []
        for i, (name, cat_name, price, cost, qty, min_qty) in enumerate(PRODUCTS, 1):
            supplier = sup_list[i % 3]
            product, created = Product.objects.get_or_create(
                sku=f'TRZ-{1000 + i}',
                defaults={
                    'name': name,
                    'description': f'{name} — منتج أصلي بضمان الوكيل.',
                    'category': cat_map[cat_name], 'supplier': supplier,
                    'price': Decimal(str(price)), 'cost': Decimal(str(cost)),
                    'quantity': qty, 'min_quantity': min_qty,
                    'barcode': f'628{i:07d}',
                })
            if created:
                Inventory.objects.create(
                    product=product, quantity_in_stock=qty,
                    last_restock_date=timezone.now())
            products.append(product)

        self.stdout.write('إنشاء المستخدمين...')

        def _password_for(username):
            """كلمات مرور ثابتة في التطوير فقط — عشوائية في وضع الإنتاج القسري"""
            if self.in_production:
                chars = string.ascii_letters + string.digits + '!@#$%^&*'
                return ''.join(random.choices(chars, k=16))
            return STAFF_PASSWORDS[username]

        staff_defs = [
            ('admin', 'admin@taraz.com', 'مشرف', 'النظام', 'admin', True, True),
            ('manager1', 'manager@taraz.com', 'مدير', 'المحل', 'manager', True, False),
            ('employee1', 'employee@taraz.com', 'موظف', 'الكاشير', 'employee', False, False),
        ]
        generated_passwords = {}
        for uname, email, first, last, role, is_staff, is_super in staff_defs:
            if not User.objects.filter(username=uname).exists():
                password = _password_for(uname)
                User.objects.create_user(
                    uname, email, password,
                    first_name=first, last_name=last, role=role,
                    is_staff=is_staff, is_superuser=is_super,
                    phone='0500000000')
                generated_passwords[uname] = password
                self.stdout.write(self.style.SUCCESS(
                    f'  {uname} / {password}'
                    if self.in_production else f'  {uname} / {password}'))

        customers = []
        for uname, email, first, last in CUSTOMERS:
            user, _ = User.objects.get_or_create(
                username=uname,
                defaults={'email': email, 'first_name': first, 'last_name': last,
                          'role': 'customer',
                          'phone': f'77{random.randint(1000000, 9999999)}',
                          'city': random.choice(['صنعاء', 'عدن', 'تعز'])})
            # التطوير فقط: كلمة مرور معروفة للبيانات التجريبية
            demo_password = ('Customer@2026' if not self.in_production
                             else _password_for('employee1'))
            user.set_password(demo_password)
            user.save(update_fields=['password'])
            customers.append(user)

        self.stdout.write('إنشاء طلبات تجريبية...')
        if Order.objects.count() == 0:
            now = timezone.localtime()
            order_count = 0
            for day_offset in range(0, 30, 2):
                for _ in range(random.randint(1, 3)):
                    customer = random.choice(customers)
                    created = now - timedelta(days=day_offset,
                                              hours=random.randint(0, 12))
                    chosen = random.sample(products, random.randint(1, 4))

                    subtotal = Decimal('0')
                    for p in chosen:
                        subtotal += p.price * random.randint(1, 3)

                    tax = (subtotal * Decimal('0.15')).quantize(Decimal('0.01'))
                    final = subtotal + tax

                    order = Order.objects.create(
                        order_number=Order.generate_order_number(),
                        customer=customer, created_by=None,
                        status=random.choice(
                            ['pending', 'confirmed', 'shipped',
                             'delivered', 'delivered']),
                        tax=tax, shipping_fee=Decimal('0'),
                        shipping_name=f'{customer.first_name} {customer.last_name}',
                        shipping_phone=customer.phone or '',
                        shipping_address='حي شمسان، شارع الستين',
                        shipping_city=customer.city or 'صنعاء',
                    )
                    # ضبط تاريخ الإنشاء
                    Order.objects.filter(pk=order.pk).update(created_at=created)

                    for p in chosen:
                        OrderItem.objects.create(
                            order=order, product=p,
                            quantity=random.randint(1, 3),
                            unit_price=p.price)
                    order.calculate_total()

                    Payment.objects.create(
                        order=order, amount=final,
                        method=random.choice(['cash', 'card', 'transfer', 'wallet']),
                        status='completed',
                        transaction_id=f'TRX-{order.order_number}')
                    Commission.objects.create(
                        order=order,
                        amount=(final * Decimal('0.05')).quantize(Decimal('0.01')),
                        percentage=Decimal('5'))
                    order_count += 1
            self.stdout.write(self.style.SUCCESS(
                f'  {order_count} طلباً عبر آخر 30 يوماً'))

        self.stdout.write(self.style.SUCCESS('\nاكتملت التهيئة!'))
        if self.in_production:
            self.stdout.write(self.style.WARNING(
                '\n⚠ أنت في وضع الإنتاج — كلمات المرور أعلاه عشوائية ولن تظهر مجدداً.'))
        else:
            self.stdout.write('\nبيانات الدخول (للتطوير فقط — لا تستخدمها في الإنتاج):')
            self.stdout.write('   مشرف:  admin / Admin@2026')
            self.stdout.write('   مدير:  manager1 / Manager@2026')
            self.stdout.write('   موظف:  employee1 / Employee@2026')
            self.stdout.write('   عميل:  ahmad / Customer@2026')
