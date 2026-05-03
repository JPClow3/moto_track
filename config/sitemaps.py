from types import SimpleNamespace

from django.conf import settings
from django.contrib.sitemaps import Sitemap
from django.contrib.sitemaps.views import _get_latest_lastmod, x_robots_tag
from django.contrib.sites.requests import RequestSite
from django.core.paginator import EmptyPage, PageNotAnInteger
from django.http import Http404
from django.template.response import TemplateResponse
from django.urls import reverse
from django.utils.http import http_date

from apps.forum.models import ForumArticle


class StaticViewSitemap(Sitemap):
    priority = 0.8
    changefreq = "daily"

    def items(self):
        return ["landing", "account_login", "account_signup", "privacy_policy", "terms_of_service", "lgpd", "cancellation_policy", "roadmap", "blog:list"]

    def location(self, item):
        return reverse(item)


class ForumArticleSitemap(Sitemap):
    priority = 0.9
    changefreq = "monthly"

    def items(self):
        return ForumArticle.objects.filter(is_published=True).only("slug", "updated_at", "published_at")

    def location(self, item):
        return reverse("blog:detail", kwargs={"slug": item.slug})

    def lastmod(self, item):
        return item.updated_at or item.published_at


def _sitemap_site(request):
    configured_domain = (settings.SITE_DOMAIN or "").strip()
    if configured_domain:
        return SimpleNamespace(domain=configured_domain, name=configured_domain)
    return RequestSite(request)


@x_robots_tag
def sitemap_view(request, sitemaps, section=None, template_name="sitemap.xml", content_type="application/xml"):
    req_protocol = request.scheme
    req_site = _sitemap_site(request)

    if section is not None:
        if section not in sitemaps:
            raise Http404(f"No sitemap available for section: {section!r}")
        maps = [sitemaps[section]]
    else:
        maps = sitemaps.values()

    page = request.GET.get("p", 1)
    lastmod = None
    all_sites_lastmod = True
    urls = []

    for site in maps:
        try:
            if callable(site):
                site = site()
            urls.extend(site.get_urls(page=page, site=req_site, protocol=req_protocol))
            if all_sites_lastmod:
                site_lastmod = getattr(site, "latest_lastmod", None)
                if site_lastmod is not None:
                    lastmod = _get_latest_lastmod(lastmod, site_lastmod)
                else:
                    all_sites_lastmod = False
        except EmptyPage as exc:
            raise Http404(f"Page {page} empty") from exc
        except PageNotAnInteger as exc:
            raise Http404(f"No page {page!r}") from exc

    headers = {"Last-Modified": http_date(lastmod.timestamp())} if all_sites_lastmod and lastmod else None
    return TemplateResponse(
        request,
        template_name,
        {"urlset": urls},
        content_type=content_type,
        headers=headers,
    )
