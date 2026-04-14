from django.urls import path

from .views import reminder_create_view, reminder_delete_view, reminder_list_view, reminder_update_view

app_name = "reminders"

urlpatterns = [
    path("", reminder_list_view, name="list"),
    path("new/", reminder_create_view, name="create"),
    path("<int:pk>/edit/", reminder_update_view, name="update"),
    path("<int:pk>/delete/", reminder_delete_view, name="delete"),
]
