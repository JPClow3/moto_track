from django.urls import path

from . import views

app_name = "fuel"

urlpatterns = [
    path("", views.fuel_list_view, name="list"),
    path("export/", views.fuel_export_view, name="export"),
    path("catalogs/", views.fuel_catalog_view, name="catalogs"),
    path("stations/new/", views.fuel_station_create_view, name="station_create"),
    path("stations/<int:pk>/edit/", views.fuel_station_update_view, name="station_update"),
    path("stations/<int:pk>/delete/", views.fuel_station_delete_view, name="station_delete"),
    path("grades/new/", views.fuel_grade_create_view, name="grade_create"),
    path("grades/<int:pk>/edit/", views.fuel_grade_update_view, name="grade_update"),
    path("grades/<int:pk>/delete/", views.fuel_grade_delete_view, name="grade_delete"),
    path("quick-create/", views.fuel_quick_create_view, name="quick_create"),
    path("repeat-last/", views.fuel_repeat_last_view, name="repeat_last"),
]
