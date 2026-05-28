from django.urls import path

from . import views

app_name = "work"

urlpatterns = [
    path("", views.work_dashboard_view, name="dashboard"),
    path("turnos/novo/", views.work_session_create_view, name="session_create"),
    path("turnos/<int:pk>/editar/", views.work_session_update_view, name="session_update"),
    path("turnos/<int:pk>/excluir/", views.work_session_delete_view, name="session_delete"),
    path("custos/<int:motorcycle_id>/", views.cost_settings_view, name="cost_settings"),
]
