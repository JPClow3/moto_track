from typing import cast

from dal import autocomplete
from django import forms
from django.utils import timezone

from apps.core.sanitizers import sanitize_text
from apps.core.validation import add_form_errors, validate_not_future, validate_odometer_sequence
from apps.garage.models import Motorcycle

from .models import MaintenancePart, MaintenancePlanItem, MaintenanceRecord


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
        labels = {
            "motorcycle": "Moto",
            "maintenance_type": "Tipo de manutenção",
            "date": "Data",
            "odometer_km": "Odômetro (km)",
            "cost": "Custo",
            "workshop": "Oficina",
            "description": "Descrição",
            "parts_used": "Peças usadas",
            "interval_km": "Intervalo em km",
            "interval_days": "Intervalo em dias",
            "parts": "Peças do catálogo",
        }
        widgets = {
            "date": forms.DateInput(attrs={"type": "date"}),
            "odometer_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "interval_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "interval_days": forms.NumberInput(attrs={"inputmode": "numeric"}),
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
        self.fields["cost"].initial = self.initial.get("cost", self.fields["cost"].initial or 0)
        self.fields["cost"].help_text = "Use 0 para manutenção DIY/gratuita."
        widget = self.fields["cost"].widget
        for subwidget in getattr(widget, "widgets", [widget]):
            subwidget.attrs.setdefault("inputmode", "decimal")

    def clean_workshop(self):
        return sanitize_text(self.cleaned_data.get("workshop"))

    def clean_description(self):
        return sanitize_text(self.cleaned_data.get("description"))

    def clean_parts_used(self):
        return sanitize_text(self.cleaned_data.get("parts_used"))

    def clean(self):
        cleaned_data = super().clean()
        add_form_errors(self, validate_not_future(field_name="date", value=cleaned_data.get("date")))
        add_form_errors(
            self,
            validate_odometer_sequence(
                motorcycle=cleaned_data.get("motorcycle"),
                event_date=cleaned_data.get("date"),
                odometer_km=cleaned_data.get("odometer_km"),
                exclude_model="maintenance.MaintenanceRecord",
                exclude_pk=self.instance.pk,
            ),
        )
        return cleaned_data


class MaintenancePartForm(forms.ModelForm):
    class Meta:
        model = MaintenancePart
        fields = ["name", "manufacturer", "part_type", "sku", "price", "notes"]
        labels = {
            "name": "Nome",
            "manufacturer": "Fabricante",
            "part_type": "Tipo de peça",
            "sku": "Código/SKU",
            "price": "Preço",
            "notes": "Observações",
        }
        widgets = {
            "notes": forms.Textarea(attrs={"rows": 2}),
        }


class MaintenancePlanItemForm(forms.ModelForm):
    class Meta:
        model = MaintenancePlanItem
        fields = [
            "motorcycle",
            "maintenance_type",
            "interval_km",
            "interval_days",
            "last_done_km",
            "last_done_date",
            "is_active",
        ]
        labels = {
            "motorcycle": "Moto",
            "maintenance_type": "Tipo de manutenção",
            "interval_km": "Intervalo em km",
            "interval_days": "Intervalo em dias",
            "last_done_km": "Última execução (km)",
            "last_done_date": "Última execução (data)",
            "is_active": "Plano ativo",
        }
        widgets = {
            "interval_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "interval_days": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "last_done_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "last_done_date": forms.DateInput(attrs={"type": "date"}),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user).order_by("name")
        for name in ["interval_km", "interval_days", "last_done_km", "last_done_date"]:
            self.fields[name].required = False
