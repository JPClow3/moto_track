from django.urls import path

from .views import forum_detail_view, forum_list_view

app_name = "blog"

urlpatterns = [
    path("", forum_list_view, name="list"),
    path("<slug:slug>/", forum_detail_view, name="detail"),
]
