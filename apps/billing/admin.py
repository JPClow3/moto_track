from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import AccountDataRequest, BillingEvent, SubscriptionProfile


@admin.register(SubscriptionProfile)
class SubscriptionProfileAdmin(ModelAdmin):
    list_display = ["user", "plan", "billing_interval", "stripe_subscription_status", "current_period_end"]
    list_filter = ["plan", "billing_interval", "stripe_subscription_status", "cancel_at_period_end"]
    search_fields = ["user__username", "user__email", "stripe_customer_id", "stripe_subscription_id"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(BillingEvent)
class BillingEventAdmin(ModelAdmin):
    list_display = ["stripe_event_id", "event_type", "processed_at", "created_at"]
    search_fields = ["stripe_event_id", "event_type"]
    readonly_fields = ["stripe_event_id", "event_type", "payload", "processed_at", "processing_error", "created_at", "updated_at"]


@admin.register(AccountDataRequest)
class AccountDataRequestAdmin(ModelAdmin):
    list_display = ["user", "request_type", "status", "created_at", "fulfilled_at"]
    list_filter = ["request_type", "status"]
    search_fields = ["user__username", "user__email"]
