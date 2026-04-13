from django import forms
from django.utils import timezone

from apps.garage.models import Motorcycle

from .models import MaintenancePart, MaintenanceRecord


class MaintenanceRecordQuickForm(forms.ModelForm):
	parts = forms.ModelMultipleChoiceField(queryset=MaintenancePart.objects.none(), required=False)
	next = forms.CharField(required=False, widget=forms.HiddenInput())

	class Meta:
		model = MaintenanceRecord
		fields = [
			"motorcycle",
			"maintenance_type",
			"date",
			"odometer_km",
			"cost",
			"workshop",
			"description",
			"parts_used",
			"interval_km",
			"interval_days",
		]
		widgets = {
			"date": forms.DateInput(attrs={"type": "date"}),
			"description": forms.Textarea(attrs={"rows": 2}),
			"parts_used": forms.Textarea(attrs={"rows": 2}),
		}

	def __init__(self, *args, user=None, **kwargs):
		super().__init__(*args, **kwargs)
		self.user = user
		self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user).order_by("name")
		self.fields["parts"].queryset = MaintenancePart.objects.filter(owner=user).order_by("name")
		self.fields["date"].initial = self.initial.get("date") or timezone.localdate()
		self.fields["workshop"].required = False
		self.fields["description"].required = False
		self.fields["parts_used"].required = False
		self.fields["interval_km"].required = False
		self.fields["interval_days"].required = False
