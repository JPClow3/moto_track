from decimal import Decimal, InvalidOperation

from django import forms
from django.utils import timezone

from apps.garage.models import Motorcycle

from .models import FuelGrade, FuelRecord, FuelStation


class FuelRecordQuickForm(forms.ModelForm):
	next = forms.CharField(required=False, widget=forms.HiddenInput())

	class Meta:
		model = FuelRecord
		fields = [
			"motorcycle",
			"station",
			"fuel_grade",
			"date",
			"odometer_km",
			"liters",
			"total_price",
			"price_per_liter",
			"fuel_type",
			"tank_full",
			"station_name",
			"notes",
		]
		widgets = {
			"date": forms.DateInput(attrs={"type": "date"}),
			"notes": forms.Textarea(attrs={"rows": 2}),
		}

	def __init__(self, *args, user=None, **kwargs):
		super().__init__(*args, **kwargs)
		self.user = user
		self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user).order_by("name")
		self.fields["station"].queryset = FuelStation.objects.filter(owner=user).order_by("name")
		self.fields["fuel_grade"].queryset = FuelGrade.objects.filter(owner=user).order_by("name")
		self.fields["date"].initial = self.initial.get("date") or timezone.localdate()
		self.fields["station"].required = False
		self.fields["fuel_grade"].required = False
		self.fields["price_per_liter"].required = False
		self.fields["station_name"].required = False
		self.fields["notes"].required = False

	def clean(self):
		cleaned_data = super().clean()
		liters = cleaned_data.get("liters")
		total_price = cleaned_data.get("total_price")
		price_per_liter = cleaned_data.get("price_per_liter")

		if liters and total_price is not None and not price_per_liter:
			try:
				cleaned_data["price_per_liter"] = (Decimal(total_price) / Decimal(liters)).quantize(Decimal("0.001"))
			except (InvalidOperation, ZeroDivisionError):
				self.add_error("price_per_liter", "Informe um preço por litro válido.")
		return cleaned_data
