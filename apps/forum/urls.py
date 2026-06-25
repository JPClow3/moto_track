from django.urls import path

from .views import forum_detail_view, forum_list_view, forum_add_comment, forum_toggle_reaction

app_name = "blog"

urlpatterns = [
    path("", forum_list_view, name="list"),
    path("<slug:slug>/", forum_detail_view, name="detail"),
    path("<slug:slug>/comment/", forum_add_comment, name="add_comment"),
    path("<slug:slug>/react/", forum_toggle_reaction, name="toggle_reaction"),
]
