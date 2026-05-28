from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import TimeStampedModel
from apps.garage.models import Motorcycle


class TriggerType(models.TextChoices):
    BY_KM = "by_km", "Por quilometragem"
    BY_DATE = "by_date", "Por data"
    BY_INTERVAL = "by_interval", "Por intervalo"


class Reminder(TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="reminders")
    title = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    trigger_type = models.CharField(max_length=16, choices=TriggerType.choices, default=TriggerType.BY_KM)
    # Default seguro para facilitar a migração inicial; pode ser ajustado nos registros.
    trigger_value_km = models.PositiveIntegerField(null=True, blank=True)
    trigger_value_days = models.PositiveIntegerField(null=True, blank=True)
    reference_km = models.PositiveIntegerField(null=True, blank=True)
    reference_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    last_notified_at = models.DateTimeField(null=True, blank=True)
    last_email_notified_at = models.DateTimeField(null=True, blank=True)
    last_push_notified_at = models.DateTimeField(null=True, blank=True)
    send_email = models.BooleanField(default=True)
    send_push = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-is_active", "title"]
        indexes = [
            models.Index(fields=["is_active"], name="reminder_active_idx"),
            models.Index(fields=["motorcycle", "is_active"], name="reminder_moto_active_idx"),
            # B-H3: dashboard reminder lookups filter by motorcycle + is_active
            # and order/filter by reference_date. Composite covers the hot path.
            models.Index(
                fields=["motorcycle", "is_active", "reference_date"],
                name="reminder_moto_active_date_idx",
            ),
        ]

    def __str__(self):
        return self.title

    def clean(self):
        errors = {}
        if self.trigger_type == TriggerType.BY_KM:
            if not self.trigger_value_km:
                errors["trigger_value_km"] = "Informe o valor em km para este lembrete."
            if self.trigger_value_km is not None and self.trigger_value_km <= 0:
                errors["trigger_value_km"] = "O valor em km deve ser maior que zero."
            if self.reference_km is None:
                errors["reference_km"] = "Informe o km de referência."
            if self.reference_date is not None:
                errors["reference_date"] = "Não informe data de referência quando o gatilho for por km."
        elif self.trigger_type == TriggerType.BY_DATE:
            if not self.trigger_value_days:
                errors["trigger_value_days"] = "Informe o intervalo em dias para este lembrete."
            if self.trigger_value_days is not None and self.trigger_value_days <= 0:
                errors["trigger_value_days"] = "O valor em dias deve ser maior que zero."
            if self.reference_date is None:
                errors["reference_date"] = "Informe a data de referência."
            if self.reference_km is not None:
                errors["reference_km"] = "Não informe km de referência quando o gatilho for por data."
        elif self.trigger_type == TriggerType.BY_INTERVAL:
            if not self.trigger_value_km and not self.trigger_value_days:
                errors["trigger_value_km"] = "Informe pelo menos um intervalo em km ou dias."
            if self.trigger_value_km is not None and self.trigger_value_km <= 0:
                errors["trigger_value_km"] = "O valor em km deve ser maior que zero."
            if self.trigger_value_km is not None and self.reference_km is None:
                errors["reference_km"] = "Informe o km de referência quando usar intervalo em km."
            if self.trigger_value_days is not None and self.trigger_value_days <= 0:
                errors["trigger_value_days"] = "O valor em dias deve ser maior que zero."
            if self.trigger_value_days is not None and self.reference_date is None:
                errors["reference_date"] = "Informe a data de referência quando usar intervalo em dias."

        if errors:
            raise ValidationError(errors)
