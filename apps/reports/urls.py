from django.urls import path

from .views import report_overview_view

app_name = "reports"

urlpatterns = [
    path("", report_overview_view, name="overview"),
]
