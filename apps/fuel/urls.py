from django.urls import path

from .views import fuel_catalog_view, fuel_list_view, fuel_quick_create_view

app_name = "fuel"

urlpatterns = [
	path("", fuel_list_view, name="list"),
	path("catalogs/", fuel_catalog_view, name="catalogs"),
	path("quick-create/", fuel_quick_create_view, name="quick_create"),
]
