from django.contrib.sitemaps import Sitemap
from django.urls import reverse

class StaticViewSitemap(Sitemap):
    priority = 0.8
    changefreq = "daily"

    def items(self):
        return ["core:index", "account_login", "account_signup"]

    def location(self, item):
        return reverse(item)
