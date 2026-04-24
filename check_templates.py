import django
from django.conf import settings
settings.configure(
    DEBUG=True,
    DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
    INSTALLED_APPS=['django.contrib.contenttypes', 'django.contrib.auth', 'django.contrib.sessions', 'django.contrib.messages', 'crispy_forms'],
    TEMPLATES=[{
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': ['templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'builtins': ['django.templatetags.static'],
        },
    }],
    SECRET_KEY='test',
    USE_TZ=True,
    STATIC_URL='/static/',
    ROOT_URLCONF='config.urls',
)

from django.template import engines
engine = engines['django']

templates_to_check = [
    'core/onboarding.html',
    'fuel/partials/quick_form.html',
    'reports/sale_report.html',
    'core/landing.html',
    'base.html',
]

for tpl in templates_to_check:
    try:
        t = engine.get_template(tpl)
        print(f"OK: {tpl}")
    except Exception as e:
        print(f"FAIL: {tpl} - {e}")
