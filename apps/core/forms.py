from django import forms
from django.utils import timezone


class OdometerOverrideForm(forms.Form):
	odometer_override_km = forms.IntegerField(min_value=1, label="Odômetro atual (km)")

	def __init__(self, *args, motorcycle=None, **kwargs):
		super().__init__(*args, **kwargs)
		self.motorcycle = motorcycle

	def clean_odometer_override_km(self):
		value = self.cleaned_data["odometer_override_km"]
		if self.motorcycle and value < self.motorcycle.computed_odometer_km:
			raise forms.ValidationError("O valor informado não pode ser menor que o odômetro calculado atual.")
		return value

	def save(self):
		if self.motorcycle is None:
			raise ValueError("motorcycle must be provided before saving odometer override")

		self.motorcycle.odometer_override_km = self.cleaned_data["odometer_override_km"]
		self.motorcycle.odometer_override_at = timezone.now()
		self.motorcycle.save(update_fields=["odometer_override_km", "odometer_override_at", "updated_at"])
		return self.motorcycle


def configure_form_accessibility(form):
	"""
	Configures aria attributes for form fields based on requirements, help text, and errors.
	"""
	for bound_field in form.visible_fields():
		widget_attrs = bound_field.field.widget.attrs
		if bound_field.field.required:
			widget_attrs["aria-required"] = "true"
		else:
			widget_attrs.pop("aria-required", None)

		describedby_ids = []
		if bound_field.help_text:
			describedby_ids.append(f"{bound_field.id_for_label}_help")
		if bound_field.errors:
			widget_attrs["aria-invalid"] = "true"
			describedby_ids.append(f"{bound_field.id_for_label}_error")
		else:
			widget_attrs.pop("aria-invalid", None)

		if describedby_ids:
			widget_attrs["aria-describedby"] = " ".join(describedby_ids)
		else:
			widget_attrs.pop("aria-describedby", None)