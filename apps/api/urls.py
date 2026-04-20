from django.urls import path

from . import views

app_name = "api_v1"

urlpatterns = [
    path("fuel-records/", views.fuel_records, name="fuel_records"),
    path("maintenance-records/", views.maintenance_records, name="maintenance_records"),
    path("tire-records/", views.tire_records, name="tire_records"),
    path("reminders/", views.reminders, name="reminders"),
    path("documents/", views.documents, name="documents"),
    path("expenses/", views.expenses, name="expenses"),
]
