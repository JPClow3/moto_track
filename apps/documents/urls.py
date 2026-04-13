from django.urls import path

from .views import list_documents

app_name = "documents"

urlpatterns = [
    path("", list_documents, name="list"),
]
