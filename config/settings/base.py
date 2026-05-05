import os
from pathlib import Path

import dj_database_url
import environ
from django.templatetags.static import static
from django.urls import reverse_lazy

BASE_DIR = Path(__file__).resolve().parents[2]
_env_path = BASE_DIR / ".env"
if _env_path.is_file():
    # In production containers (DJANGO_DEBUG=0), allow the mounted .env file
    # to override empty defaults that docker-compose may interpolate.
    _overwrite = os.environ.get("DJANGO_DEBUG") == "0"
    environ.Env.read_env(_env_path, overwrite=_overwrite)
env = environ.Env(
    DJANGO_DEBUG=(bool, False),
)

_settings_module = os.environ.get("DJANGO_SETTINGS_MODULE", "")
_local_secret_key_default = (
    "insecure-local-dev-secret-key"
    if _settings_module in {"config.settings.dev", "config.settings.test"}
    else environ.Env.NOTSET
)
SECRET_KEY = env("DJANGO_SECRET_KEY", default=_local_secret_key_default)
PUSH_ENCRYPTION_KEY = env("PUSH_ENCRYPTION_KEY", default="")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["127.0.0.1", "localhost"])
SITE_DOMAIN = env("SITE_DOMAIN", default="")

SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    def _safe_float(var, default):
        val = env(var, default=default).strip()
        return float(val) if val else float(default)

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(),
            LoggingIntegration(),
        ],
        release=env("APP_BUILD_ID", default="dev"),
        environment=env("SENTRY_ENVIRONMENT", default="production" if not DEBUG else "development"),
        send_default_pii=True,
        enable_logs=True,
        traces_sample_rate=_safe_float("SENTRY_TRACES_SAMPLE_RATE", "0.1"),
        profile_session_sample_rate=_safe_float("SENTRY_PROFILES_SAMPLE_RATE", "0.05"),
        profile_lifecycle="trace",
    )

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
    "apps.forum",
    "apps.billing",
    "apps.work",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "config.middleware.RequestIDMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "apps.accounts.middleware.EmailVerificationRequiredMiddleware",
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
                "apps.core.context_processors.site_settings_context",
                "apps.core.context_processors.garage_context",
                "apps.billing.context_processors.billing_context",
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
SESSION_COOKIE_AGE = env.int("SESSION_COOKIE_AGE", default=60 * 60 * 24 * 30)

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
ACCOUNT_ADAPTER = "apps.accounts.adapters.MotoAccountAdapter"
SOCIALACCOUNT_ADAPTER = "apps.accounts.adapters.MotoSocialAccountAdapter"
SOCIALACCOUNT_LOGIN_ON_GET = True
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
            "50": "254 242 242",
            "100": "254 226 226",
            "200": "254 202 202",
            "300": "252 165 165",
            "400": "248 113 113",
            "500": "239 68 68",
            "600": "220 38 38",
            "700": "185 28 28",
            "800": "153 27 27",
            "900": "127 29 29",
            "950": "69 10 10",
        },
        "font": {
            "subtle-light": "113 113 122",
            "subtle-dark": "161 161 170",
            "default-light": "24 24 27",
            "default-dark": "250 250 250",
            "important-light": "24 24 27",
            "important-dark": "250 250 250",
        },
    },
    "DARK_MODE": True,
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

DEFAULT_CURRENCY = "BRL"
CURRENCIES = ("BRL",)

STRIPE_API_VERSION = env("STRIPE_API_VERSION", default="2026-02-25.clover")
STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY", default="")
STRIPE_PUBLISHABLE_KEY = env("STRIPE_PUBLISHABLE_KEY", default="")
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET", default="")
STRIPE_PRO_MONTHLY_PRICE_ID = env("STRIPE_PRO_MONTHLY_PRICE_ID", default="")
STRIPE_PRO_YEARLY_PRICE_ID = env("STRIPE_PRO_YEARLY_PRICE_ID", default="")
STRIPE_PAYMENT_METHOD_TYPES = env.list("STRIPE_PAYMENT_METHOD_TYPES", default=["pix", "card"])

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Production security headers (HTTPS, HSTS, secure cookies) live in `config.settings.prod`.
# Do not gate them on `DEBUG` here: the test runner forces `DEBUG=False`, which would
# incorrectly enable `SECURE_SSL_REDIRECT` during tests and break HTTP clients with 301s.
