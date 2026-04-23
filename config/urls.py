"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from allauth.account import views as allauth_views
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView

from .sitemaps import StaticViewSitemap, sitemap_view

sitemaps = {
    "static": StaticViewSitemap,
}

urlpatterns = [
    path("", include("apps.core.urls")),
    path("garage/", include("apps.garage.urls")),
    path("fuel/", include("apps.fuel.urls")),
    path("maintenance/", include("apps.maintenance.urls")),
    path("tires/", include("apps.tires.urls")),
    path("documents/", include("apps.documents.urls")),
    path("reminders/", include("apps.reminders.urls")),
    path("expenses/", include("apps.expenses.urls")),
    path("reports/", include("apps.reports.urls")),
    path("attachments/", include("apps.core.attachment_urls", namespace="attachments")),
    path("api/v1/", include("apps.api.urls", namespace="api_v1")),
    path("politica/", TemplateView.as_view(template_name="legal/privacy.html"), name="privacy_policy"),
    path("termos/", TemplateView.as_view(template_name="legal/terms.html"), name="terms_of_service"),
    path("accounts/login/", allauth_views.LoginView.as_view(), name="login"),
    path("accounts/logout/", allauth_views.LogoutView.as_view(), name="logout"),
    path("accounts/", include("allauth.urls")),
    path("admin/", admin.site.urls),
    path("sitemap.xml", sitemap_view, {"sitemaps": sitemaps}, name="django.contrib.sitemaps.views.sitemap"),
    path(
        "robots.txt",
        TemplateView.as_view(
            template_name="robots.txt",
            content_type="text/plain",
            extra_context={"site_domain": settings.SITE_DOMAIN},
        ),
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
