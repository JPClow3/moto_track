from django import forms

from apps.core.sanitizers import sanitize_text

from .models import Motorcycle, MotorcycleSpec


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
            "riding_profile",
            "previous_owners",
            "purchase_price",
            "purchase_date",
            "observations",
        ]
        widgets = {
            "license_plate": forms.TextInput(attrs={"placeholder": "ABC1D23"}),
            "previous_owners": forms.NumberInput(attrs={"placeholder": "0"}),
            "odometer_override_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "year": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "purchase_date": forms.DateInput(attrs={"type": "date"}),
            "observations": forms.Textarea(
                attrs={"placeholder": "Ex.: revisões feitas, detalhes do estado, mods, etc."}
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            if field.required:
                field.widget.attrs["aria-required"] = "true"
            field.widget.attrs.setdefault("autocomplete", "off")

        self.fields["license_plate"].required = False
        self.fields["odometer_override_km"].required = False
        self.fields["previous_owners"].required = False
        self.fields["riding_profile"].required = False
        self.fields["purchase_price"].required = False
        self.fields["purchase_date"].required = False
        self.fields["observations"].required = False

    def clean_name(self):
        return sanitize_text(self.cleaned_data.get("name"))

    def clean_brand(self):
        return sanitize_text(self.cleaned_data.get("brand"))

    def clean_model(self):
        return sanitize_text(self.cleaned_data.get("model"))

    def clean_license_plate(self):
        return sanitize_text(self.cleaned_data.get("license_plate"))

    def clean_observations(self):
        return sanitize_text(self.cleaned_data.get("observations"))


class MotorcycleSpecForm(forms.ModelForm):
    class Meta:
        model = MotorcycleSpec
        exclude = ["motorcycle"]
        widgets = {
            "fuel_tank_capacity_l": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
            "fuel_octane_min": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "oil_capacity_l": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.required = False
            field.widget.attrs.setdefault("autocomplete", "off")

    def clean_fuel_type_recommendation(self):
        return sanitize_text(self.cleaned_data.get("fuel_type_recommendation"))

    def clean_tire_size_front(self):
        return sanitize_text(self.cleaned_data.get("tire_size_front"))

    def clean_tire_size_rear(self):
        return sanitize_text(self.cleaned_data.get("tire_size_rear"))

    def clean_oil_type_recommendation(self):
        return sanitize_text(self.cleaned_data.get("oil_type_recommendation"))

    def clean_manual_reference(self):
        return sanitize_text(self.cleaned_data.get("manual_reference"))
