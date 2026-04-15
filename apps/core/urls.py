from django.urls import path

from . import views  # pylint: disable=no-name-in-module

urlpatterns = [
    path("", views.dashboard_view, name="dashboard"),
    path("quick-odometer-update/", views.odometer_quick_update_view, name="quick_odometer_update"),
    path("quick-add/", views.quick_add_selector_view, name="quick_add"),
    path("offline/", views.offline_view, name="offline"),
]
