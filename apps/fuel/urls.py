from django.urls import path

from .views import (
	fuel_catalog_view,
	fuel_defaults_view,
	fuel_export_view,
	fuel_grade_create_view,
	fuel_grade_delete_view,
	fuel_grade_update_view,
	fuel_import_confirm_view,
	fuel_import_preview_view,
	fuel_list_view,
	fuel_ocr_scan_view,
	fuel_quick_create_view,
	fuel_record_delete_view,
	fuel_record_update_view,
	fuel_repeat_last_view,
	fuel_review_settings_view,
	fuel_station_create_view,
	fuel_station_delete_view,
	fuel_station_update_view,
)

app_name = "fuel"

urlpatterns = [
	path("", fuel_list_view, name="list"),
	path("export/", fuel_export_view, name="export"),
	path("import/", fuel_import_preview_view, name="import_preview"),
	path("import/confirm/", fuel_import_confirm_view, name="import_confirm"),
	path("defaults/", fuel_defaults_view, name="defaults"),
	path("catalogs/", fuel_catalog_view, name="catalogs"),
	path("records/<int:pk>/edit/", fuel_record_update_view, name="update"),
	path("records/<int:pk>/delete/", fuel_record_delete_view, name="delete"),
	path("review-settings/", fuel_review_settings_view, name="review_settings"),
	path("stations/new/", fuel_station_create_view, name="station_create"),
	path("stations/<int:pk>/edit/", fuel_station_update_view, name="station_update"),
	path("stations/<int:pk>/delete/", fuel_station_delete_view, name="station_delete"),
	path("grades/new/", fuel_grade_create_view, name="grade_create"),
	path("grades/<int:pk>/edit/", fuel_grade_update_view, name="grade_update"),
	path("grades/<int:pk>/delete/", fuel_grade_delete_view, name="grade_delete"),
	path("quick-create/", fuel_quick_create_view, name="quick_create"),
	path("repeat-last/", fuel_repeat_last_view, name="repeat_last"),
	path("ocr-scan/", fuel_ocr_scan_view, name="ocr_scan"),
]
