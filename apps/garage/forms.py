from django import forms
from django.db.models import Max

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
        labels = {
            "name": "Nome da moto",
            "brand": "Marca",
            "model": "Modelo",
            "year": "Ano",
            "photo": "Foto",
            "license_plate": "Placa",
            "odometer_override_km": "Odômetro atual (km)",
            "riding_profile": "Perfil de condução",
            "previous_owners": "Proprietários anteriores",
            "purchase_price": "Valor de compra",
            "purchase_date": "Data de compra",
            "observations": "Observações",
        }
        widgets = {
            "license_plate": forms.TextInput(attrs={"placeholder": "ABC1D23"}),
            "previous_owners": forms.NumberInput(attrs={"placeholder": "0"}),
            "odometer_override_km": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "year": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "purchase_date": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
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

    def clean_odometer_override_km(self):
        value = self.cleaned_data.get("odometer_override_km")
        if value is None or self.instance.pk is None:
            return value

        fuel_max = self.instance.fuel_records.aggregate(max_odometer=Max("odometer_km"))["max_odometer"] or 0
        maintenance_max = self.instance.maintenance_records.aggregate(max_odometer=Max("odometer_km"))["max_odometer"] or 0
        tire_max = self.instance.tire_records.aggregate(max_odometer=Max("installed_odometer_km"))["max_odometer"] or 0
        record_max = max(int(fuel_max or 0), int(maintenance_max or 0), int(tire_max or 0))
        if int(value) < record_max:
            raise forms.ValidationError(
                f"O valor informado não pode ser menor que o maior km registrado ({record_max} km)."
            )
        return value


class MotorcycleSpecForm(forms.ModelForm):
    class Meta:
        model = MotorcycleSpec
        exclude = ["motorcycle"]
        labels = {
            "fuel_tank_capacity_l": "Capacidade do tanque (L)",
            "fuel_type_recommendation": "Combustível recomendado",
            "fuel_octane_min": "Octanagem mínima",
            "oil_capacity_l": "Capacidade de óleo (L)",
            "tire_size_front": "Medida do pneu dianteiro",
            "tire_size_rear": "Medida do pneu traseiro",
            "tire_speed_rating": "Índice de velocidade",
            "battery_spec": "Especificação da bateria",
            "chain_size": "Medida da relação/corrente",
            "recommended_tire_pressure_front": "Pressão dianteira recomendada",
            "recommended_tire_pressure_rear": "Pressão traseira recomendada",
            "oil_type_recommendation": "Óleo recomendado",
            "oil_viscosity_recommendation": "Viscosidade do óleo",
            "manual_reference": "Referência do manual",
            "consumption_avg_km_l": "Consumo de referência (km/L)",
        }
        help_texts = {
            "consumption_avg_km_l": (
                "Use o valor oficial ou de catálogo da moto. A média real de uso é calculada automaticamente "
                "pelos abastecimentos registrados."
            ),
        }
        widgets = {
            "fuel_tank_capacity_l": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
            "fuel_octane_min": forms.NumberInput(attrs={"inputmode": "numeric"}),
            "oil_capacity_l": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
            "consumption_avg_km_l": forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
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
