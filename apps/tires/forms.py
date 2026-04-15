from django import forms

from apps.garage.models import Motorcycle

from .models import TireProduct, TireRecord


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
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user).order_by("name")
        self.fields["tire_product"].queryset = TireProduct.objects.filter(owner=user).order_by(
            "manufacturer", "model_name"
        )
        self.fields["tire_product"].required = False
        self.fields["purchase_price"].required = False
        self.fields["recommended_pressure"].required = False
        self.fields["estimated_change_km"].required = False

        for field in self.visible_fields():
            if field.field.required:
                field.field.widget.attrs["aria-required"] = "true"
