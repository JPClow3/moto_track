from django.urls import path

from . import views

app_name = "billing"

urlpatterns = [
    path("conta/", views.billing_account_view, name="account"),
    path("checkout/", views.checkout_view, name="checkout"),
    path("portal/", views.portal_view, name="portal"),
    path("dados/exportar/", views.data_export_view, name="data_export"),
    path("dados/excluir/", views.data_deletion_request_view, name="data_deletion_request"),
    path("webhook/stripe/", views.stripe_webhook_view, name="stripe_webhook"),
]
