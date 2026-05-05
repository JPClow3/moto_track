from django import forms
from django.utils import timezone

from apps.core.sanitizers import sanitize_text
from apps.core.validation import add_form_errors, validate_not_future, validate_odometer_sequence
from apps.garage.models import Motorcycle

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
        labels = {
            "motorcycle": "Moto",
            "tire_product": "Pneu do catálogo",
            "position": "Posição",
            "brand_model": "Marca e modelo",
            "installed_at": "Data de instalação",
            "installed_odometer_km": "Odômetro na instalação (km)",
            "cost": "Custo instalado",
            "purchase_price": "Preço de compra",
            "recommended_pressure": "Pressão recomendada",
            "wear_percent": "Desgaste (%)",
            "estimated_change_km": "Troca estimada em km",
            "is_active": "Pneu ativo",
        }
        widgets = {
            "installed_at": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "installed_odometer_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "wear_percent": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "estimated_change_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
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
        for name in ["cost", "purchase_price"]:
            widget = self.fields[name].widget
            for subwidget in getattr(widget, "widgets", [widget]):
                subwidget.attrs.setdefault("inputmode", "decimal")

        for field in self.visible_fields():
            if field.field.required:
                field.field.widget.attrs["aria-required"] = "true"

    def clean(self):
        cleaned_data = super().clean()
        add_form_errors(self, validate_not_future(field_name="installed_at", value=cleaned_data.get("installed_at")))
        errors = validate_odometer_sequence(
            motorcycle=cleaned_data.get("motorcycle"),
            event_date=cleaned_data.get("installed_at"),
            odometer_km=cleaned_data.get("installed_odometer_km"),
            exclude_model="tires.TireRecord",
            exclude_pk=self.instance.pk,
        )
        if "odometer_km" in errors:
            errors["installed_odometer_km"] = errors.pop("odometer_km")
        add_form_errors(self, errors)
        return cleaned_data


class TirePressureRecordForm(forms.ModelForm):
    class Meta:
        model = TirePressureRecord
        fields = ["motorcycle", "date", "psi_front", "psi_rear", "notes"]
        labels = {
            "motorcycle": "Moto",
            "date": "Data",
            "psi_front": "PSI dianteiro",
            "psi_rear": "PSI traseiro",
            "notes": "Observações",
        }
        widgets = {
            "date": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "psi_front": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "psi_rear": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args, user=None, initial_motorcycle=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user).order_by("name")  # pylint: disable=no-member
        if initial_motorcycle:
            self.fields["motorcycle"].initial = initial_motorcycle
        self.fields["date"].initial = self.initial.get("date") or timezone.localdate()
        self.fields["notes"].required = False

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))


class TireProductForm(forms.ModelForm):
    class Meta:
        model = TireProduct
        fields = [
            "manufacturer",
            "model_name",
            "image",
            "tire_type",
            "width_mm",
            "aspect_ratio",
            "rim_diameter_in",
            "load_index",
            "speed_rating",
            "max_speed_kmh",
            "price",
            "notes",
        ]
        labels = {
            "manufacturer": "Fabricante",
            "model_name": "Modelo",
            "image": "Imagem",
            "tire_type": "Tipo",
            "width_mm": "Largura (mm)",
            "aspect_ratio": "Perfil",
            "rim_diameter_in": "Aro (pol.)",
            "load_index": "Índice de carga",
            "speed_rating": "Índice de velocidade",
            "max_speed_kmh": "Velocidade máxima (km/h)",
            "price": "Preço",
            "notes": "Observações",
        }
        widgets = {
            "notes": forms.Textarea(attrs={"rows": 2}),
            "image": forms.ClearableFileInput(attrs={"accept": "image/*"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name in ["width_mm", "aspect_ratio", "rim_diameter_in", "max_speed_kmh", "price", "notes"]:
            self.fields[name].required = False

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))
