from pathlib import Path

import dj_database_url
import environ
from django.templatetags.static import static
from django.urls import reverse_lazy

BASE_DIR = Path(__file__).resolve().parents[2]
environ.Env.read_env(BASE_DIR / ".env", overwrite=False)
env = environ.Env(
    DJANGO_DEBUG=(bool, False),
)

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["127.0.0.1", "localhost"])
SITE_DOMAIN = env("SITE_DOMAIN", default="")

INSTALLED_APPS = [
    "unfold",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "django.contrib.sitemaps",
    "storages",
    "crispy_forms",
    "crispy_tailwind",
    "dal",
    "dal_select2",
    "slippers",
    "allauth_ui",
    "widget_tweaks",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "djmoney",
    "django_bleach",
    "django_cotton",
    "apps.core",
    "apps.accounts",
    "apps.garage",
    "apps.fuel.apps.FuelConfig",
    "apps.maintenance.apps.MaintenanceConfig",
    "apps.tires.apps.TiresConfig",
    "apps.documents",
    "apps.reminders",
    "apps.reports",
    "apps.expenses",
    "apps.inventory",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.core.context_processors.garage_context",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": dj_database_url.parse(
        env("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=600,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

LOGIN_URL = "account_login"
LOGIN_REDIRECT_URL = "dashboard"
LOGOUT_REDIRECT_URL = "account_login"

EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@motoapp.local")
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=10)

SITE_ID = env.int("DJANGO_SITE_ID", default=1)

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

CRISPY_ALLOWED_TEMPLATE_PACKS = ("tailwind",)
CRISPY_TEMPLATE_PACK = "tailwind"

ACCOUNT_LOGIN_METHODS = {"username", "email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "username*", "password1*", "password2*"]
ACCOUNT_FORMS = {
    "signup": "apps.accounts.forms.SignupForm",
}
ACCOUNT_UNIQUE_EMAIL = True
_account_email_verification_raw = env("ACCOUNT_EMAIL_VERIFICATION", default="mandatory")
ACCOUNT_EMAIL_VERIFICATION = _account_email_verification_raw.split("#", 1)[0].strip().lower() or "mandatory"
if ACCOUNT_EMAIL_VERIFICATION not in {"mandatory", "optional", "none"}:
    ACCOUNT_EMAIL_VERIFICATION = "mandatory"

APP_BUILD_ID = env("APP_BUILD_ID", default="dev")
WEB_PUSH_PUBLIC_KEY = env("WEB_PUSH_PUBLIC_KEY", default=env("PUSH_PUBLIC_KEY", default=""))
ACCOUNT_CONFIRM_EMAIL_ON_GET = env.bool("ACCOUNT_CONFIRM_EMAIL_ON_GET", default=True)
ACCOUNT_DEFAULT_HTTP_PROTOCOL = env(
    "ACCOUNT_DEFAULT_HTTP_PROTOCOL",
    default="http" if DEBUG else "https",
)
ACCOUNT_LOGOUT_ON_GET = False
ACCOUNT_RATE_LIMITS = {
    "login_failed": "5/m",
}
ALLAUTH_UI_THEME = "light"


def _admin_static(path):
    return lambda request: static(path)


UNFOLD = {
    "SITE_TITLE": "Moto Track Admin",
    "SITE_HEADER": "Moto Track",
    "SITE_SUBHEADER": "Gestao operacional",
    "SITE_URL": "/",
    "SITE_SYMBOL": "speed",
    "SITE_ICON": _admin_static("brand/moto-track-icon.png"),
    "SITE_FAVICONS": [
        {
            "rel": "icon",
            "href": _admin_static("brand/favicon.ico"),
            "type": "image/x-icon",
        },
        {
            "rel": "icon",
            "href": _admin_static("brand/favicon-32x32.png"),
            "type": "image/png",
            "sizes": "32x32",
        }
    ],
    "STYLES": [
        _admin_static("admin/mototrack_admin.css"),
    ],
    "COLORS": {
        "primary": {
            "50": "239 246 255",
            "100": "219 234 254",
            "200": "191 219 254",
            "300": "147 197 253",
            "400": "96 165 250",
            "500": "59 130 246",
            "600": "37 99 235",
            "700": "29 78 216",
            "800": "30 64 175",
            "900": "30 58 138",
            "950": "23 37 84",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": "Principal",
                "separator": True,
                "items": [
                    {
                        "title": "Usuarios",
                        "icon": "group",
                        "link": reverse_lazy("admin:auth_user_changelist"),
                    },
                    {
                        "title": "Motos",
                        "icon": "two_wheeler",
                        "link": reverse_lazy("admin:garage_motorcycle_changelist"),
                    },
                    {
                        "title": "Templates de motos",
                        "icon": "fact_check",
                        "link": reverse_lazy("admin:garage_motorcycletemplate_changelist"),
                    },
                ],
            },
            {
                "title": "Operacao",
                "separator": True,
                "items": [
                    {
                        "title": "Documentos",
                        "icon": "description",
                        "link": reverse_lazy("admin:documents_motorcycledocument_changelist"),
                    },
                    {
                        "title": "Manutencoes",
                        "icon": "build",
                        "link": reverse_lazy("admin:maintenance_maintenancerecord_changelist"),
                    },
                    {
                        "title": "Abastecimentos",
                        "icon": "local_gas_station",
                        "link": reverse_lazy("admin:fuel_fuelrecord_changelist"),
                    },
                ],
            },
        ],
    },
}

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
        "APP": {
            "client_id": env("GOOGLE_CLIENT_ID", default=""),
            "secret": env("GOOGLE_CLIENT_SECRET", default=""),
            "key": "",
        },
    }
}

BLEACH_ALLOWED_TAGS = []
BLEACH_ALLOWED_ATTRIBUTES = {}
BLEACH_ALLOWED_PROTOCOLS = ["http", "https", "mailto"]
BLEACH_STRIP_TAGS = True
BLEACH_STRIP_COMMENTS = True

DEFAULT_CURRENCY = "BRL"
CURRENCIES = ("BRL",)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Production security headers (HTTPS, HSTS, secure cookies) live in `config.settings.prod`.
# Do not gate them on `DEBUG` here: the test runner forces `DEBUG=False`, which would
# incorrectly enable `SECURE_SSL_REDIRECT` during tests and break HTTP clients with 301s.
