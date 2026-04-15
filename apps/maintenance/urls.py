from django.urls import path

from .views import (
    MaintenancePartAutocomplete,
    maintenance_catalog_view,
    maintenance_list_view,
    maintenance_part_create_view,
    maintenance_part_delete_view,
    maintenance_part_update_view,
    maintenance_quick_create_view,
)

app_name = "maintenance"

urlpatterns = [
    path("", maintenance_list_view, name="list"),
    path("catalogs/", maintenance_catalog_view, name="catalogs"),
    path("parts/new/", maintenance_part_create_view, name="part_create"),
    path("parts/<int:pk>/edit/", maintenance_part_update_view, name="part_update"),
    path("parts/<int:pk>/delete/", maintenance_part_delete_view, name="part_delete"),
    path("quick-create/", maintenance_quick_create_view, name="quick_create"),
    path("parts-autocomplete/", MaintenancePartAutocomplete.as_view(), name="part_autocomplete"),
]
