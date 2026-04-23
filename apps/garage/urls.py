from django.urls import path

from .views import (
    garage_create_view,
    garage_delete_view,
    garage_list_view,
    garage_restore_view,
    garage_spec_update_view,
    garage_update_view,
)

app_name = "garage"

urlpatterns = [
    path("", garage_list_view, name="list"),
    path("new/", garage_create_view, name="create"),
    path("<int:pk>/edit/", garage_update_view, name="update"),
    path("<int:pk>/specs/", garage_spec_update_view, name="spec_update"),
    path("<int:pk>/delete/", garage_delete_view, name="delete"),
    path("<int:pk>/restore/", garage_restore_view, name="restore"),
]
