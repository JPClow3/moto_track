from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


class BillingPlan(models.TextChoices):
    FREE = "free", "Free"
    PRO = "pro", "Pro"


class BillingInterval(models.TextChoices):
    MONTHLY = "monthly", "Mensal"
    YEARLY = "yearly", "Anual"


class SubscriptionProfile(TimeStampedModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscription_profile")
    plan = models.CharField(max_length=16, choices=BillingPlan.choices, default=BillingPlan.FREE)
    billing_interval = models.CharField(
        max_length=16,
        choices=BillingInterval.choices,
        blank=True,
        default="",
    )
    stripe_customer_id = models.CharField(max_length=120, blank=True, default="", db_index=True)
    stripe_subscription_id = models.CharField(max_length=120, blank=True, default="", db_index=True)
    stripe_subscription_status = models.CharField(max_length=40, blank=True, default="")
    stripe_price_id = models.CharField(max_length=120, blank=True, default="")
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    grace_until = models.DateTimeField(null=True, blank=True)
    latest_invoice_url = models.URLField(max_length=500, blank=True, default="")
    latest_receipt_url = models.URLField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["user__username"]

    def __str__(self) -> str:
        return f"{self.user} - {self.get_plan_display()}"

    def mark_payment_failed(self) -> None:
        self.grace_until = timezone.now() + timedelta(days=3)
        if not self.stripe_subscription_status:
            self.stripe_subscription_status = "past_due"
        self.save(update_fields=["grace_until", "stripe_subscription_status", "updated_at"])

    def has_pro_access(self, *, now=None) -> bool:
        now = now or timezone.now()
        if self.plan != BillingPlan.PRO:
            return False
        if self.stripe_subscription_status == "active":
            return True
        if self.grace_until and self.grace_until >= now:
            return True
        return False


class BillingEvent(TimeStampedModel):
    stripe_event_id = models.CharField(max_length=120, unique=True)
    event_type = models.CharField(max_length=120)
    payload = models.JSONField(default=dict)
    processed_at = models.DateTimeField(null=True, blank=True)
    processing_error = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.event_type} ({self.stripe_event_id})"


class AccountDataRequest(TimeStampedModel):
    class RequestType(models.TextChoices):
        EXPORT = "export", "Exportacao"
        DELETION = "deletion", "Exclusao"

    class Status(models.TextChoices):
        OPEN = "open", "Aberto"
        DONE = "done", "Concluido"
        REJECTED = "rejected", "Rejeitado"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="data_requests")
    request_type = models.CharField(max_length=16, choices=RequestType.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    notes = models.TextField(blank=True, default="")
    fulfilled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_request_type_display()} - {self.user}"
