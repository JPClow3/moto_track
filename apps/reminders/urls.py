from django.urls import path

from .views import reminder_list_view

app_name = "reminders"

urlpatterns = [
    path("", reminder_list_view, name="list"),
]
