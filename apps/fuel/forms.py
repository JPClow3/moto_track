from decimal import Decimal, InvalidOperation
from typing import cast

from django import forms
from django.utils import timezone

from apps.core.sanitizers import sanitize_text
from apps.garage.models import Motorcycle

from .models import FuelGrade, FuelRecord, FuelStation


class FuelRecordQuickForm(forms.ModelForm):
    class Meta:
        model = FuelRecord
        fields = [
            "motorcycle",
            "station",
            "fuel_grade",
            "date",
            "odometer_km",
            "liters",
            "total_price",
            "price_per_liter",
            "fuel_type",
            "tank_full",
            "station_name",
            "notes",
        ]
        widgets = {
            "date": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user
        motorcycle_field = cast(forms.ModelChoiceField, self.fields["motorcycle"])
        station_field = cast(forms.ModelChoiceField, self.fields["station"])
        fuel_grade_field = cast(forms.ModelChoiceField, self.fields["fuel_grade"])
        motorcycle_field.queryset = Motorcycle.objects.filter(owner=user).order_by("name")  # pylint: disable=no-member
        station_field.queryset = FuelStation.objects.filter(owner=user).order_by("name")  # pylint: disable=no-member
        fuel_grade_field.queryset = FuelGrade.objects.filter(owner=user).order_by("name")  # pylint: disable=no-member
        self.fields["date"].initial = self.initial.get("date") or timezone.localdate()
        self.fields["station"].required = False
        self.fields["fuel_grade"].required = False
        self.fields["price_per_liter"].required = False
        self.fields["station_name"].required = False
        self.fields["notes"].required = False

    def clean(self):
        cleaned_data = super().clean()
        liters = cleaned_data.get("liters")
        total_price = cleaned_data.get("total_price")
        price_per_liter = cleaned_data.get("price_per_liter")

        if liters and total_price is not None and not price_per_liter:
            try:
                total_amount = getattr(total_price, "amount", total_price)
                cleaned_data["price_per_liter"] = (Decimal(total_amount) / Decimal(liters)).quantize(Decimal("0.001"))
            except (InvalidOperation, ZeroDivisionError):
                self.add_error("price_per_liter", "Informe um preço por litro válido.")
        return cleaned_data

    def clean_station_name(self):
        return sanitize_text(self.cleaned_data.get("station_name"))

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))


class FuelRecordRepeatForm(forms.ModelForm):
    """
    Minimal repeat form: duplicates the last fill-up and asks only for the new numbers.

    Catalog-ish fields are passed as hidden inputs to keep the 1-click flow.
    """

    class Meta:
        model = FuelRecord
        fields = [
            "motorcycle",
            "station",
            "fuel_grade",
            "date",
            "odometer_km",
            "liters",
            "total_price",
            "price_per_liter",
            "fuel_type",
            "tank_full",
            "station_name",
            "notes",
        ]
        widgets = {
            "date": forms.DateInput(attrs={"type": "date"}),
            "station": forms.HiddenInput(),
            "fuel_grade": forms.HiddenInput(),
            "price_per_liter": forms.HiddenInput(),
            "fuel_type": forms.HiddenInput(),
            "tank_full": forms.HiddenInput(),
            "station_name": forms.HiddenInput(),
            "notes": forms.HiddenInput(),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user
        motorcycle_field = cast(forms.ModelChoiceField, self.fields["motorcycle"])
        station_field = cast(forms.ModelChoiceField, self.fields["station"])
        fuel_grade_field = cast(forms.ModelChoiceField, self.fields["fuel_grade"])
        motorcycle_field.queryset = Motorcycle.objects.filter(owner=user).order_by("name")  # pylint: disable=no-member
        station_field.queryset = FuelStation.objects.filter(owner=user).order_by("name")  # pylint: disable=no-member
        fuel_grade_field.queryset = FuelGrade.objects.filter(owner=user).order_by("name")  # pylint: disable=no-member
        self.fields["date"].initial = self.initial.get("date") or timezone.localdate()
        self.fields["station"].required = False
        self.fields["fuel_grade"].required = False
        self.fields["price_per_liter"].required = False
        self.fields["station_name"].required = False
        self.fields["notes"].required = False

    def clean(self):
        cleaned_data = super().clean()
        liters = cleaned_data.get("liters")
        total_price = cleaned_data.get("total_price")
        price_per_liter = cleaned_data.get("price_per_liter")

        if liters and total_price is not None and not price_per_liter:
            try:
                total_amount = getattr(total_price, "amount", total_price)
                cleaned_data["price_per_liter"] = (Decimal(total_amount) / Decimal(liters)).quantize(Decimal("0.001"))
            except (InvalidOperation, ZeroDivisionError):
                self.add_error("total_price", "Informe um valor total válido.")
        return cleaned_data

    def clean_station_name(self):
        return sanitize_text(self.cleaned_data.get("station_name"))

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))


class FuelStationForm(forms.ModelForm):
    class Meta:
        model = FuelStation
        fields = ["name", "brand", "city", "state", "notes"]
        widgets = {"notes": forms.Textarea(attrs={"rows": 2})}


class FuelGradeForm(forms.ModelForm):
    class Meta:
        model = FuelGrade
        fields = ["name", "fuel_type", "octane_rating", "ethanol_percentage", "default_price_per_liter", "notes"]
        widgets = {"notes": forms.Textarea(attrs={"rows": 2})}
