from django import forms
from django.utils import timezone


class OdometerOverrideForm(forms.Form):
	odometer_override_km = forms.IntegerField(min_value=1, label="Odômetro atual (km)")
	next = forms.CharField(required=False, widget=forms.HiddenInput())

	def __init__(self, *args, motorcycle=None, **kwargs):
		super().__init__(*args, **kwargs)
		self.motorcycle = motorcycle

	def clean_odometer_override_km(self):
		value = self.cleaned_data["odometer_override_km"]
		if self.motorcycle and value < self.motorcycle.computed_odometer_km:
			raise forms.ValidationError("O valor informado não pode ser menor que o odômetro calculado atual.")
		return value

	def save(self):
		self.motorcycle.odometer_override_km = self.cleaned_data["odometer_override_km"]
		self.motorcycle.odometer_override_at = timezone.now()
		self.motorcycle.save(update_fields=["odometer_override_km", "odometer_override_at", "updated_at"])
		return self.motorcycle