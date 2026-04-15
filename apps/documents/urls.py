from django.urls import path

from .views import create_document_reminder, delete_document, document_export_view, list_documents

app_name = "documents"

urlpatterns = [
    path("", list_documents, name="list"),
    path("export/", document_export_view, name="export"),
    path("<int:pk>/delete/", delete_document, name="delete"),
    path("<int:pk>/reminder/", create_document_reminder, name="create_reminder"),
]
