from django import forms

from apps.core.sanitizers import sanitize_text
from .models import Motorcycle


class MotorcycleForm(forms.ModelForm):
	class Meta:
		model = Motorcycle
		fields = [
			"name",
			"brand",
			"model",
			"year",
			"photo",
			"license_plate",
			"odometer_override_km",
		]
		widgets = {
			"license_plate": forms.TextInput(attrs={"placeholder": "ABC1D23"}),
		}

	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		for field_name, field in self.fields.items():
			if field.required:
				field.widget.attrs["aria-required"] = "true"
			field.widget.attrs.setdefault("autocomplete", "off")

		self.fields["license_plate"].required = False
		self.fields["odometer_override_km"].required = False

	def clean_name(self):
		return sanitize_text(self.cleaned_data.get("name"))

	def clean_brand(self):
		return sanitize_text(self.cleaned_data.get("brand"))

	def clean_model(self):
		return sanitize_text(self.cleaned_data.get("model"))

	def clean_license_plate(self):
		return sanitize_text(self.cleaned_data.get("license_plate"))
