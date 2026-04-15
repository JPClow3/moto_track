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
            "previous_owners",
            "purchase_price",
            "purchase_date",
            "observations",
        ]
        widgets = {
            "license_plate": forms.TextInput(attrs={"placeholder": "ABC1D23"}),
            "previous_owners": forms.NumberInput(attrs={"placeholder": "0"}),
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
