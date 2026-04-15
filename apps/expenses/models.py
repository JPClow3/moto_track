from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import models
from djmoney.models.fields import MoneyField

from apps.core.models import TimeStampedModel
from apps.garage.models import Motorcycle


class AnnualFeeType(models.TextChoices):
    IPVA = "ipva", "IPVA"
    DPVAT = "dpvat", "DPVAT"
    LICENSING = "licensing", "Licenciamento"
    OTHER = "other", "Outro"


class AnnualFee(TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="annual_fees")
    fee_type = models.CharField(max_length=24, choices=AnnualFeeType.choices, default=AnnualFeeType.IPVA)
    year = models.PositiveSmallIntegerField()
    due_date = models.DateField()
    paid_date = models.DateField(null=True, blank=True)
    amount = MoneyField(max_digits=10, decimal_places=2)
    notify_before_days = models.PositiveSmallIntegerField(default=30)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-due_date"]
        unique_together = [("motorcycle", "fee_type", "year")]

    def __str__(self) -> str:
        return f"{self.get_fee_type_display()} {self.year} - {self.motorcycle.name}"  # pylint: disable=no-member

    def clean(self):
        errors = {}
        if self.notify_before_days is not None and self.notify_before_days <= 0:
            errors["notify_before_days"] = "O aviso deve ser maior que zero."
        if self.paid_date and self.paid_date < self.due_date:
            # allow, but usually a data entry mistake; keep as validation error for now
            errors["paid_date"] = "A data de pagamento não pode ser anterior ao vencimento."
        if errors:
            raise ValidationError(errors)


class InsurancePolicy(TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="insurance_policies")
    provider = models.CharField(max_length=120)
    policy_number = models.CharField(max_length=80, blank=True)
    coverage_start = models.DateField()
    coverage_end = models.DateField()
    premium = MoneyField(max_digits=10, decimal_places=2)
    notify_before_days = models.PositiveSmallIntegerField(default=30)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-coverage_end", "provider"]

    def __str__(self) -> str:
        return f"{self.provider} - {self.motorcycle.name}"

    def clean(self):
        errors = {}
        if self.notify_before_days is not None and self.notify_before_days <= 0:
            errors["notify_before_days"] = "O aviso deve ser maior que zero."
        if self.coverage_end and self.coverage_start and self.coverage_end < self.coverage_start:
            errors["coverage_end"] = "A data final não pode ser anterior à data inicial."
        if errors:
            raise ValidationError(errors)


class ClaimStatus(models.TextChoices):
    OPEN = "open", "Aberto"
    SETTLED = "settled", "Resolvido"
    DENIED = "denied", "Negado"


class InsuranceClaim(TimeStampedModel):
    policy = models.ForeignKey(InsurancePolicy, on_delete=models.CASCADE, related_name="claims")
    claim_date = models.DateField()
    description = models.TextField()
    amount = MoneyField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=16, choices=ClaimStatus.choices, default=ClaimStatus.OPEN)

    class Meta:
        ordering = ["-claim_date", "-created_at"]

    def __str__(self) -> str:
        return f"Sinistro {self.claim_date} - {self.policy.provider}"  # pylint: disable=no-member
