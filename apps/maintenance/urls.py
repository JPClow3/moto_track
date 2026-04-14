from django.urls import path

from .views import (
	MaintenancePartAutocomplete,
	maintenance_catalog_view,
	maintenance_list_view,
	maintenance_quick_create_view,
)

app_name = "maintenance"

urlpatterns = [
	path("", maintenance_list_view, name="list"),
	path("catalogs/", maintenance_catalog_view, name="catalogs"),
	path("quick-create/", maintenance_quick_create_view, name="quick_create"),
	path("parts-autocomplete/", MaintenancePartAutocomplete.as_view(), name="part_autocomplete"),
]
