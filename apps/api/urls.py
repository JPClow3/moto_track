from django.urls import path

from . import views

app_name = "api_v1"

urlpatterns = [
    path("fuel-records/", views.FuelRecordsView.as_view(), name="fuel_records"),
    path("maintenance-records/", views.MaintenanceRecordsView.as_view(), name="maintenance_records"),
    path("tire-records/", views.TireRecordsView.as_view(), name="tire_records"),
    path("reminders/", views.RemindersView.as_view(), name="reminders"),
    path("documents/", views.DocumentsView.as_view(), name="documents"),
    path("expenses/", views.ExpensesView.as_view(), name="expenses"),
]
