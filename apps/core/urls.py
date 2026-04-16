from django.urls import path

from .views import (
    dashboard_view,
    odometer_quick_update_view,
    offline_view,
    onboarding_view,
    quick_add_selector_view,
    undo_action_view,
)

urlpatterns = [
    path("", dashboard_view, name="dashboard"),
    path("quick-odometer-update/", odometer_quick_update_view, name="quick_odometer_update"),
    path("quick-add/", quick_add_selector_view, name="quick_add"),
    path("onboarding/", onboarding_view, name="onboarding"),
    path("undo/<str:token>/", undo_action_view, name="undo_action"),
    path("offline/", offline_view, name="offline"),
]
