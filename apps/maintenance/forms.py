from typing import cast

from dal import autocomplete
from django import forms
from django.utils import timezone

from apps.core.sanitizers import sanitize_text
from apps.garage.models import Motorcycle

from .models import MaintenancePart, MaintenanceRecord


class MaintenanceRecordQuickForm(forms.ModelForm):
    parts = forms.ModelMultipleChoiceField(
        queryset=MaintenancePart.objects.none(),
        required=False,
        widget=autocomplete.ModelSelect2Multiple(url="maintenance:part_autocomplete"),
    )

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
        motorcycle_field = cast(forms.ModelChoiceField, self.fields["motorcycle"])
        parts_field = cast(forms.ModelMultipleChoiceField, self.fields["parts"])
        motorcycle_field.queryset = Motorcycle.objects.filter(owner=user).order_by("name")
        parts_field.queryset = MaintenancePart.objects.filter(owner=user).order_by("name")
        self.fields["date"].initial = self.initial.get("date") or timezone.localdate()
        self.fields["workshop"].required = False
        self.fields["description"].required = False
        self.fields["parts_used"].required = False
        self.fields["interval_km"].required = False
        self.fields["interval_days"].required = False

    def clean_workshop(self):
        return sanitize_text(self.cleaned_data.get("workshop"))

    def clean_description(self):
        return sanitize_text(self.cleaned_data.get("description"))

    def clean_parts_used(self):
        return sanitize_text(self.cleaned_data.get("parts_used"))


class MaintenancePartForm(forms.ModelForm):
    class Meta:
        model = MaintenancePart
        fields = ["name", "manufacturer", "part_type", "sku", "price", "notes"]
        widgets = {"notes": forms.Textarea(attrs={"rows": 2})}
