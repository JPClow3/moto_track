from django.urls import path

from .views import (
    OnboardingTemplateAutocomplete,
    dashboard_view,
    odometer_quick_update_view,
    offline_view,
    onboarding_template_preview_view,
    onboarding_view,
    quick_add_selector_view,
    service_worker_view,
    undo_action_view,
    push_subscribe_view,
)

urlpatterns = [
    path("", dashboard_view, name="dashboard"),
    path("quick-odometer-update/", odometer_quick_update_view, name="quick_odometer_update"),
    path("quick-add/", quick_add_selector_view, name="quick_add"),
    path("onboarding/", onboarding_view, name="onboarding"),
    path(
        "onboarding/template-autocomplete/",
        OnboardingTemplateAutocomplete.as_view(),
        name="onboarding_template_autocomplete",
    ),
    path("onboarding/template-preview/", onboarding_template_preview_view, name="onboarding_template_preview"),
    path("undo/<str:token>/", undo_action_view, name="undo_action"),
    path("offline/", offline_view, name="offline"),
    path("sw.js", service_worker_view, name="service_worker"),
    path("api/push/subscribe/", push_subscribe_view, name="push_subscribe"),
]
