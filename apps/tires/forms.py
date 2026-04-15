from django import forms

from apps.garage.models import Motorcycle

from django.utils import timezone

from apps.core.sanitizers import sanitize_text

from .models import TirePressureRecord, TireProduct, TireRecord


class TireRecordForm(forms.ModelForm):
    class Meta:
        model = TireRecord
        fields = [
            "motorcycle",
            "tire_product",
            "position",
            "brand_model",
            "installed_at",
            "installed_odometer_km",
            "cost",
            "purchase_price",
            "recommended_pressure",
            "wear_percent",
            "estimated_change_km",
            "is_active",
        ]
        widgets = {
            "installed_at": forms.DateInput(attrs={"type": "date"}),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user).order_by("name")  # pylint: disable=no-member
        self.fields["tire_product"].queryset = TireProduct.objects.filter(owner=user).order_by(  # pylint: disable=no-member
            "manufacturer", "model_name"
        )
        self.fields["tire_product"].required = False
        self.fields["purchase_price"].required = False
        self.fields["recommended_pressure"].required = False
        self.fields["estimated_change_km"].required = False

        for field in self.visible_fields():
            if field.field.required:
                field.field.widget.attrs["aria-required"] = "true"


class TirePressureRecordForm(forms.ModelForm):
    class Meta:
        model = TirePressureRecord
        fields = ["motorcycle", "date", "psi_front", "psi_rear", "notes"]
        widgets = {"date": forms.DateInput(attrs={"type": "date"}), "notes": forms.Textarea(attrs={"rows": 2})}

    def __init__(self, *args, user=None, initial_motorcycle=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user).order_by("name")  # pylint: disable=no-member
        if initial_motorcycle:
            self.fields["motorcycle"].initial = initial_motorcycle
        self.fields["date"].initial = self.initial.get("date") or timezone.localdate()
        self.fields["notes"].required = False

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))
