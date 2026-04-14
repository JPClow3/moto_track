from django.urls import path

from .views import delete_document, list_documents

app_name = "documents"

urlpatterns = [
    path("", list_documents, name="list"),
    path("<int:pk>/delete/", delete_document, name="delete"),
]
