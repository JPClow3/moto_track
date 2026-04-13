from django.db import models

from apps.garage.models import Motorcycle


class DocumentType(models.TextChoices):
	MANUAL = "manual", "Manual"
	CRLV = "crlv", "CRLV"
	INSURANCE = "insurance", "Seguro"
	RECEIPT = "receipt", "Nota Fiscal"
	OTHER = "other", "Outro"


class MotorcycleDocument(models.Model):
	motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="documents")
	name = models.CharField(max_length=140)
	document_type = models.CharField(max_length=32, choices=DocumentType.choices, default=DocumentType.OTHER)
	file = models.FileField(upload_to="documents/%Y/%m/")
	notes = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["name"]

	def __str__(self):
		return self.name

# Create your models here.
