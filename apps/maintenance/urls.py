from django.urls import path

from . import views

app_name = "maintenance"

urlpatterns = [
    path("", views.maintenance_list_view, name="list"),
    path("export/", views.maintenance_export_view, name="export"),
    path("catalogs/", views.maintenance_catalog_view, name="catalogs"),
    path("parts/new/", views.maintenance_part_create_view, name="part_create"),
    path("parts/<int:pk>/edit/", views.maintenance_part_update_view, name="part_update"),
    path("parts/<int:pk>/delete/", views.maintenance_part_delete_view, name="part_delete"),
    path("quick-create/", views.maintenance_quick_create_view, name="quick_create"),
    path("parts-autocomplete/", views.MaintenancePartAutocomplete.as_view(), name="part_autocomplete"),
]
