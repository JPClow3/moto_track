from django.contrib import admin, messages
from django.utils import timezone
from unfold.admin import ModelAdmin

from .models import AccountDataRequest, BillingEvent, SubscriptionProfile


@admin.register(SubscriptionProfile)
class SubscriptionProfileAdmin(ModelAdmin):
    list_display = [
        "user",
        "plan",
        "billing_interval",
        "stripe_subscription_status",
        "current_period_end",
        "cancel_at_period_end",
    ]
    list_filter = ["plan", "billing_interval", "stripe_subscription_status", "cancel_at_period_end"]
    search_fields = ["user__username", "user__email", "stripe_customer_id", "stripe_subscription_id"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(BillingEvent)
class BillingEventAdmin(ModelAdmin):
    list_display = ["stripe_event_id", "event_type", "processed_at", "processing_error", "created_at"]
    list_filter = [
        ("processed_at", admin.EmptyFieldListFilter),
        ("processing_error", admin.EmptyFieldListFilter),
        "event_type",
    ]
    search_fields = ["stripe_event_id", "event_type", "processing_error"]
    readonly_fields = ["stripe_event_id", "event_type", "payload", "processed_at", "processing_error", "created_at", "updated_at"]


@admin.action(description="Marcar como concluido")
def mark_done(modeladmin, request, queryset):
    updated = queryset.update(status=AccountDataRequest.Status.DONE, fulfilled_at=timezone.now())
    messages.success(request, f"{updated} solicitacao(oes) marcada(s) como concluida(s).")


@admin.action(description="Rejeitar solicitacao")
def mark_rejected(modeladmin, request, queryset):
    updated = queryset.update(status=AccountDataRequest.Status.REJECTED, fulfilled_at=timezone.now())
    messages.success(request, f"{updated} solicitacao(oes) rejeitada(s).")


@admin.register(AccountDataRequest)
class AccountDataRequestAdmin(ModelAdmin):
    list_display = ["user", "request_type", "status", "created_at", "fulfilled_at"]
    list_filter = ["request_type", "status"]
    search_fields = ["user__username", "user__email", "notes"]
    fields = ["user", "request_type", "status", "notes", "fulfilled_at", "created_at", "updated_at"]
    readonly_fields = ["user", "request_type", "created_at", "updated_at"]
    actions = [mark_done, mark_rejected]
