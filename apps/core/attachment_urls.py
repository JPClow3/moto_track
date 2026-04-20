from django.urls import path

from .attachment_views import attachment_create_view, attachment_delete_view

app_name = "attachments"

urlpatterns = [
    path("<str:app_label>/<str:model>/<int:object_id>/", attachment_create_view, name="create"),
    path("<int:pk>/delete/", attachment_delete_view, name="delete"),
]
