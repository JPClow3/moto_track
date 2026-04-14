from django import forms

from .models import Motorcycle


class MotorcycleForm(forms.ModelForm):
	class Meta:
		model = Motorcycle
		fields = [
			"name",
			"brand",
			"model",
			"year",
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
