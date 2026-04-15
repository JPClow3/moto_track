from django.urls import path

from . import views

app_name = "reminders"

urlpatterns = [
    path("", views.reminder_list_view, name="list"),
    path("export/", views.reminder_export_view, name="export"),
    path("new/", views.reminder_create_view, name="create"),
    path("<int:pk>/edit/", views.reminder_update_view, name="update"),
    path("<int:pk>/delete/", views.reminder_delete_view, name="delete"),
    path("<int:pk>/snooze-days/<int:days>/", views.reminder_snooze_days_view, name="snooze_days"),
    path("<int:pk>/snooze-km/<int:km>/", views.reminder_snooze_km_view, name="snooze_km"),
]
