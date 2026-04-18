from decimal import Decimal, InvalidOperation
from typing import cast

from django import forms
from django.utils import timezone

from apps.core.sanitizers import sanitize_text
from apps.core.validation import add_form_errors, money_amount, validate_not_future, validate_odometer_sequence
from apps.garage.models import Motorcycle

from .models import FuelGrade, FuelRecord, FuelStation


class FuelRecordBaseForm(forms.ModelForm):
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
        labels = {
            "motorcycle": "Moto",
            "station": "Posto cadastrado",
            "fuel_grade": "Combustível cadastrado",
            "date": "Data",
            "odometer_km": "Odômetro (km)",
            "liters": "Litros",
            "total_price": "Valor total",
            "price_per_liter": "Preço por litro",
            "fuel_type": "Tipo de combustível",
            "tank_full": "Tanque cheio",
            "station_name": "Nome do posto",
            "notes": "Observações",
        }
        widgets = {
            "date": forms.DateInput(attrs={"type": "date"}),
            "odometer_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "liters": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.001"}),
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
        self.fields["tank_full"].help_text = (
            "Marque quando completar o tanque. O consumo médio precisa de pelo menos dois tanques cheios."
        )
        for name in ["total_price", "price_per_liter"]:
            widget = self.fields[name].widget
            for subwidget in getattr(widget, "widgets", [widget]):
                subwidget.attrs.setdefault("inputmode", "decimal")

    def clean(self):
        cleaned_data = super().clean()
        liters = cleaned_data.get("liters")
        total_price = cleaned_data.get("total_price")
        price_per_liter = cleaned_data.get("price_per_liter")
        total_amount = getattr(total_price, "amount", total_price) if total_price is not None else None

        if liters and total_amount is not None and Decimal(total_amount) <= 0:
            self.add_error("total_price", "Informe um valor total maior que zero para calcular o preço por litro.")
            return cleaned_data

        if liters and total_price is not None and not price_per_liter:
            try:
                cleaned_data["price_per_liter"] = (Decimal(total_amount) / Decimal(liters)).quantize(Decimal("0.001"))
            except (InvalidOperation, ZeroDivisionError):
                self.add_error("price_per_liter", "Informe um preço por litro válido.")

        self._validate_quality(cleaned_data)
        return cleaned_data

    def _validate_quality(self, cleaned_data):
        motorcycle = cleaned_data.get("motorcycle")
        event_date = cleaned_data.get("date")
        odometer_km = cleaned_data.get("odometer_km")
        liters = cleaned_data.get("liters")
        total_price = cleaned_data.get("total_price")

        add_form_errors(self, validate_not_future(field_name="date", value=event_date))
        add_form_errors(
            self,
            validate_odometer_sequence(
                motorcycle=motorcycle,
                event_date=event_date,
                odometer_km=odometer_km,
                exclude_model="fuel.FuelRecord",
                exclude_pk=self.instance.pk,
            ),
        )

        if not (motorcycle and event_date and odometer_km is not None and liters and total_price is not None):
            return

        duplicate_qs = FuelRecord.objects.filter(
            motorcycle=motorcycle,
            date=event_date,
            odometer_km=odometer_km,
            liters=liters,
            fuel_type=cleaned_data.get("fuel_type"),
            station=cleaned_data.get("station"),
            fuel_grade=cleaned_data.get("fuel_grade"),
            station_name=cleaned_data.get("station_name") or "",
        )
        if self.instance.pk:
            duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
        total_amount = money_amount(total_price)
        for duplicate in duplicate_qs:
            if money_amount(duplicate.total_price) == total_amount:
                self.add_error(None, "Este abastecimento parece duplicado.")
                break

    def clean_station_name(self):
        return sanitize_text(self.cleaned_data.get("station_name"))

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))


class FuelRecordQuickForm(FuelRecordBaseForm):
    """Default quick-entry form for fuel records."""


class FuelRecordRepeatForm(FuelRecordBaseForm):
    """
    Minimal repeat form: duplicates the last fill-up and asks only for the new numbers.

    Catalog-ish fields are passed as hidden inputs to keep the 1-click flow.
    """

    class Meta(FuelRecordBaseForm.Meta):
        widgets = {
            "date": forms.DateInput(attrs={"type": "date"}),
            "odometer_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "liters": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.001"}),
            "station": forms.HiddenInput(),
            "fuel_grade": forms.HiddenInput(),
            "price_per_liter": forms.HiddenInput(),
            "fuel_type": forms.HiddenInput(),
            "tank_full": forms.HiddenInput(),
            "station_name": forms.HiddenInput(),
            "notes": forms.HiddenInput(),
        }

    def clean(self):
        cleaned_data = super().clean()
        if self.errors.get("price_per_liter"):
            self.add_error("total_price", "Informe um valor total válido.")
        return cleaned_data


class FuelStationForm(forms.ModelForm):
    class Meta:
        model = FuelStation
        fields = ["name", "brand", "city", "state", "notes"]
        labels = {
            "name": "Nome",
            "brand": "Bandeira",
            "city": "Cidade",
            "state": "UF",
            "notes": "Observações",
        }
        widgets = {"notes": forms.Textarea(attrs={"rows": 2})}


class FuelGradeForm(forms.ModelForm):
    class Meta:
        model = FuelGrade
        fields = ["name", "fuel_type", "octane_rating", "ethanol_percentage", "default_price_per_liter", "notes"]
        labels = {
            "name": "Nome",
            "fuel_type": "Tipo de combustível",
            "octane_rating": "Octanagem",
            "ethanol_percentage": "Percentual de etanol",
            "default_price_per_liter": "Preço padrão por litro",
            "notes": "Observações",
        }
        widgets = {
            "octane_rating": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "ethanol_percentage": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }
