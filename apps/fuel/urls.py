from django.urls import path

from .views import (
	fuel_catalog_view,
	fuel_export_view,
	fuel_grade_create_view,
	fuel_grade_delete_view,
	fuel_grade_update_view,
	fuel_list_view,
	fuel_quick_create_view,
	fuel_repeat_last_view,
	fuel_station_create_view,
	fuel_station_delete_view,
	fuel_station_update_view,
)

app_name = "fuel"

urlpatterns = [
	path("", fuel_list_view, name="list"),
	path("export/", fuel_export_view, name="export"),
	path("catalogs/", fuel_catalog_view, name="catalogs"),
	path("stations/new/", fuel_station_create_view, name="station_create"),
	path("stations/<int:pk>/edit/", fuel_station_update_view, name="station_update"),
	path("stations/<int:pk>/delete/", fuel_station_delete_view, name="station_delete"),
	path("grades/new/", fuel_grade_create_view, name="grade_create"),
	path("grades/<int:pk>/edit/", fuel_grade_update_view, name="grade_update"),
	path("grades/<int:pk>/delete/", fuel_grade_delete_view, name="grade_delete"),
	path("quick-create/", fuel_quick_create_view, name="quick_create"),
	path("repeat-last/", fuel_repeat_last_view, name="repeat_last"),
]
