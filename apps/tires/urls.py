from django.urls import path

from .views import tire_catalog_view

app_name = "tires"

urlpatterns = [
	path("", tire_catalog_view, name="catalogs"),
]
