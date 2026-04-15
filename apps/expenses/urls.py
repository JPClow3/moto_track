from django.urls import path

from .views import (
    annual_fee_create_view,
    annual_fee_delete_view,
    annual_fee_update_view,
    claim_create_view,
    claim_delete_view,
    claim_update_view,
    expenses_list_view,
    policy_create_view,
    policy_delete_view,
    policy_update_view,
)

app_name = "expenses"

urlpatterns = [
    path("", expenses_list_view, name="list"),
    path("fees/new/", annual_fee_create_view, name="fee_create"),
    path("fees/<int:pk>/edit/", annual_fee_update_view, name="fee_update"),
    path("fees/<int:pk>/delete/", annual_fee_delete_view, name="fee_delete"),
    path("policies/new/", policy_create_view, name="policy_create"),
    path("policies/<int:pk>/edit/", policy_update_view, name="policy_update"),
    path("policies/<int:pk>/delete/", policy_delete_view, name="policy_delete"),
    path("policies/<int:policy_pk>/claims/new/", claim_create_view, name="claim_create"),
    path("claims/<int:pk>/edit/", claim_update_view, name="claim_update"),
    path("claims/<int:pk>/delete/", claim_delete_view, name="claim_delete"),
]
