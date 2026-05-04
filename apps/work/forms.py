from django import forms
from django.core.exceptions import ValidationError

from apps.core.sanitizers import sanitize_text
from apps.garage.models import Motorcycle

from .models import ProfessionalCostSettings, WorkSession

DATETIME_LOCAL_FORMATS = ["%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S"]


class WorkSessionForm(forms.ModelForm):
    class Meta:
        model = WorkSession
        fields = [
            "motorcycle",
            "work_date",
            "started_at",
            "ended_at",
            "odometer_start_km",
            "odometer_end_km",
            "gross_income",
            "tips",
            "deliveries_count",
            "platform_source",
            "payment_method",
            "notes",
        ]
        labels = {
            "motorcycle": "Moto",
            "work_date": "Data",
            "started_at": "Inicio",
            "ended_at": "Fim",
            "odometer_start_km": "Km inicial",
            "odometer_end_km": "Km final",
            "gross_income": "Ganhos do turno",
            "tips": "Gorjetas",
            "deliveries_count": "Entregas/corridas",
            "platform_source": "Origem",
            "payment_method": "Pagamento",
            "notes": "Observacoes",
        }
        widgets = {
            "work_date": forms.DateInput(attrs={"type": "date"}),
            "started_at": forms.DateTimeInput(format=DATETIME_LOCAL_FORMATS[0], attrs={"type": "datetime-local"}),
            "ended_at": forms.DateTimeInput(format=DATETIME_LOCAL_FORMATS[0], attrs={"type": "datetime-local"}),
            "odometer_start_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "odometer_end_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "gross_income": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
            "tips": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
            "deliveries_count": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user, is_active=True).order_by("name")
        self.fields["started_at"].required = False
        self.fields["ended_at"].required = False
        self.fields["started_at"].input_formats = DATETIME_LOCAL_FORMATS + list(self.fields["started_at"].input_formats)
        self.fields["ended_at"].input_formats = DATETIME_LOCAL_FORMATS + list(self.fields["ended_at"].input_formats)
        self.fields["tips"].required = False
        self.fields["deliveries_count"].required = False
        self.fields["notes"].required = False

    def save(self, commit=True):
        obj = super().save(commit=False)
        if self.user and not obj.owner_id:
            obj.owner = self.user
        if commit:
            obj.save()
            self.save_m2m()
        return obj

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))

    def clean(self):
        cleaned_data = super().clean()
        motorcycle = cleaned_data.get("motorcycle")
        started_at = cleaned_data.get("started_at")
        ended_at = cleaned_data.get("ended_at")
        odometer_start = cleaned_data.get("odometer_start_km")
        odometer_end = cleaned_data.get("odometer_end_km")
        gross_income = cleaned_data.get("gross_income")
        tips = cleaned_data.get("tips")

        if motorcycle and self.user and motorcycle.owner_id != self.user.id:
            self.add_error("motorcycle", "Selecione uma moto da sua garagem.")
        if started_at and ended_at and ended_at < started_at:
            self.add_error("ended_at", "O fim do turno nao pode ser anterior ao inicio.")
        if odometer_start is not None and odometer_end is not None and int(odometer_end) < int(odometer_start):
            self.add_error("odometer_end_km", "O km final nao pode ser menor que o inicial.")
        if gross_income is not None and gross_income < 0:
            self.add_error("gross_income", "O faturamento nao pode ser negativo.")
        if tips is not None and tips < 0:
            self.add_error("tips", "As gorjetas nao podem ser negativas.")
        return cleaned_data


class ProfessionalCostSettingsForm(forms.ModelForm):
    class Meta:
        model = ProfessionalCostSettings
        fields = ["maintenance_reserve_per_km", "depreciation_per_km", "fixed_daily_cost"]
        labels = {
            "maintenance_reserve_per_km": "Reserva de manutencao por km",
            "depreciation_per_km": "Depreciacao por km",
            "fixed_daily_cost": "Custo fixo por dia",
        }
        widgets = {
            "maintenance_reserve_per_km": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.001"}),
            "depreciation_per_km": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.001"}),
            "fixed_daily_cost": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
        }

    def clean(self):
        cleaned_data = super().clean()
        errors = {}
        for field in ("maintenance_reserve_per_km", "depreciation_per_km", "fixed_daily_cost"):
            value = cleaned_data.get(field)
            if value is not None and value < 0:
                errors[field] = "O valor nao pode ser negativo."
        if errors:
            raise ValidationError(errors)
        return cleaned_data
