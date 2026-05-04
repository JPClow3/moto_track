from django.urls import path

from .views import (
    dashboard_view,
    landing_view,
    manifest_view,
    message_list_view,
    odometer_quick_update_view,
    offline_view,
    pwa_status_view,
    push_subscribe_view,
    quick_add_selector_view,
    service_worker_view,
    theme_preference_view,
    undo_action_view,
)
from .views_onboarding import (
    OnboardingTemplateAutocomplete,
    demo_bike_create_view,
    onboarding_template_preview_view,
    onboarding_view,
)

urlpatterns = [
    path("", landing_view, name="landing"),
    path("dashboard/", dashboard_view, name="dashboard"),
    path("quick-odometer-update/", odometer_quick_update_view, name="quick_odometer_update"),
    path("quick-add/", quick_add_selector_view, name="quick_add"),
    path("onboarding/", onboarding_view, name="onboarding"),
    path("onboarding/demo-bike/", demo_bike_create_view, name="demo_bike_create"),
    path(
        "onboarding/template-autocomplete/",
        OnboardingTemplateAutocomplete.as_view(),
        name="onboarding_template_autocomplete",
    ),
    path("onboarding/template-preview/", onboarding_template_preview_view, name="onboarding_template_preview"),
    path("undo/<str:token>/", undo_action_view, name="undo_action"),
    path("offline/", offline_view, name="offline"),
    path("manifest.webmanifest", manifest_view, name="manifest"),
    path("sw.js", service_worker_view, name="service_worker"),
    path("api/push/subscribe/", push_subscribe_view, name="push_subscribe"),
    path("api/pwa/status/", pwa_status_view, name="pwa_status"),
    path("api/theme/", theme_preference_view, name="theme_preference"),
    path("api/messages/", message_list_view, name="message_list"),
]
