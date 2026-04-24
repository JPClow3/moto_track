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
from django.http import Http404
from django.urls import include, path
from django.views.generic import RedirectView, TemplateView

from .error_views import status_preview_view
from .sitemaps import ForumArticleSitemap, StaticViewSitemap, sitemap_view

sitemaps = {
    "static": StaticViewSitemap,
    "blog": ForumArticleSitemap,
}


def debug_status_preview_view(request, status_code):
    if not settings.DEBUG:
        raise Http404
    return status_preview_view(request, status_code)

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
    path("blog/", include("apps.forum.urls")),
    path("forum/<path:path>", RedirectView.as_view(url="/blog/%(path)s", permanent=True)),
    path("forum/", RedirectView.as_view(url="/blog/", permanent=True)),
    path("api/v1/", include("apps.api.urls", namespace="api_v1")),
    path("status/<int:status_code>/", debug_status_preview_view, name="status_preview"),
    path("politica/", TemplateView.as_view(template_name="legal/privacy.html"), name="privacy_policy"),
    path("termos/", TemplateView.as_view(template_name="legal/terms.html"), name="terms_of_service"),
    path("roadmap/", TemplateView.as_view(template_name="core/roadmap.html"), name="roadmap"),
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
        name="robots_txt",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

    def trigger_error(request):
        division_by_zero = 1 / 0

    urlpatterns += [path("sentry-debug/", trigger_error)]

handler400 = "config.error_views.handler400"
handler403 = "config.error_views.handler403"
handler404 = "config.error_views.handler404"
handler500 = "config.error_views.handler500"
