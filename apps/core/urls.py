from django.urls import path

from .views import dashboard_view, odometer_quick_update_view, offline_view  # pylint: disable=no-name-in-module

urlpatterns = [
    path("", dashboard_view, name="dashboard"),
    path("quick-odometer-update/", odometer_quick_update_view, name="quick_odometer_update"),
    path("offline/", offline_view, name="offline"),
]
