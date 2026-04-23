from django.db import models

from apps.core.models import TimeStampedModel
from apps.garage.models import Motorcycle


class DocumentType(models.TextChoices):
    MANUAL = "manual", "Manual"
    CRLV = "crlv", "CRLV"
    INSURANCE = "insurance", "Seguro"
    RECEIPT = "receipt", "Nota Fiscal"
    OTHER = "other", "Outro"


class MotorcycleDocument(TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="documents")
    name = models.CharField(max_length=140)
    document_type = models.CharField(max_length=32, choices=DocumentType.choices, default=DocumentType.OTHER)
    file = models.FileField(upload_to="documents/%Y/%m/")
    valid_until = models.DateField(null=True, blank=True)
    notify_before_days = models.PositiveSmallIntegerField(default=30)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return str(self.name)


# Create your models here.
