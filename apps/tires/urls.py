from django.urls import path

from .views import (
    tire_export_view,
    tire_catalog_view,
    tire_create_view,
    tire_delete_view,
    tire_list_view,
    tire_pressure_create_view,
    tire_update_view,
)

app_name = "tires"

urlpatterns = [
    path("", tire_list_view, name="list"),
    path("export/", tire_export_view, name="export"),
    path("pressure/new/", tire_pressure_create_view, name="pressure_create"),
    path("new/", tire_create_view, name="create"),
    path("<int:pk>/edit/", tire_update_view, name="update"),
    path("<int:pk>/delete/", tire_delete_view, name="delete"),
    path("catalogs/", tire_catalog_view, name="catalogs"),
]
