from django import forms
from django.db.models import Max
from django.utils import timezone

from apps.garage.services import recompute_motorcycle_odometer
from apps.garage.models import RidingProfile


class OdometerOverrideForm(forms.Form):
    odometer_override_km = forms.IntegerField(min_value=0, label="Odômetro atual (km)")

    def __init__(self, *args, motorcycle=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.motorcycle = motorcycle
        field = self.fields["odometer_override_km"]
        field.label = "Odômetro atual (km)"
        field.widget.attrs["min"] = "0"
        field.widget.attrs.setdefault("inputmode", "numeric")
        field.help_text = (
            "Pode corrigir um override digitado alto, mas não pode ficar abaixo do maior km já registrado "
            "em abastecimentos, manutenções ou pneus."
        )

    def clean_odometer_override_km(self):
        value = self.cleaned_data["odometer_override_km"]
        if self.motorcycle:
            fuel_max = self.motorcycle.fuel_records.aggregate(max_odometer=Max("odometer_km"))["max_odometer"] or 0
            maintenance_max = (
                self.motorcycle.maintenance_records.aggregate(max_odometer=Max("odometer_km"))["max_odometer"] or 0
            )
            tire_max = (
                self.motorcycle.tire_records.aggregate(max_odometer=Max("installed_odometer_km"))["max_odometer"] or 0
            )
            record_max = max(int(fuel_max or 0), int(maintenance_max or 0), int(tire_max or 0))
            if value < record_max:
                raise forms.ValidationError(
                    f"O valor informado não pode ser menor que o maior km registrado ({record_max} km)."
                )
        return value

    def save(self):
        if self.motorcycle is None:
            raise ValueError("motorcycle must be provided before saving odometer override")

        self.motorcycle.odometer_override_km = self.cleaned_data["odometer_override_km"]
        self.motorcycle.odometer_override_at = timezone.now()
        self.motorcycle.save(update_fields=["odometer_override_km", "odometer_override_at", "updated_at"])
        recompute_motorcycle_odometer(self.motorcycle.id)
        return self.motorcycle


def configure_form_accessibility(form):
    """
    Configures aria attributes for form fields based on requirements, help text, and errors.
    """
    for bound_field in form.visible_fields():
        widget_attrs = bound_field.field.widget.attrs
        if bound_field.field.required:
            widget_attrs["aria-required"] = "true"
        else:
            widget_attrs.pop("aria-required", None)

        describedby_ids = []
        if bound_field.help_text:
            describedby_ids.append(f"{bound_field.id_for_label}_help")
        if bound_field.errors:
            widget_attrs["aria-invalid"] = "true"
            describedby_ids.append(f"{bound_field.id_for_label}_error")
        else:
            widget_attrs.pop("aria-invalid", None)

        if describedby_ids:
            widget_attrs["aria-describedby"] = " ".join(describedby_ids)
        else:
            widget_attrs.pop("aria-describedby", None)


class OnboardingForm(forms.Form):
    motorcycle_name = forms.CharField(label="Nome da moto", max_length=120)
    brand = forms.CharField(label="Marca", max_length=80)
    model = forms.CharField(label="Modelo", max_length=120)
    year = forms.IntegerField(label="Ano", min_value=1900, widget=forms.NumberInput(attrs={"inputmode": "numeric"}))
    current_odometer_km = forms.IntegerField(
        label="Km atual", min_value=0, widget=forms.NumberInput(attrs={"inputmode": "numeric"})
    )
    riding_profile = forms.ChoiceField(label="Perfil de condução", choices=RidingProfile.choices, required=False)

    fuel_date = forms.DateField(label="Data do último abastecimento", widget=forms.DateInput(attrs={"type": "date"}))
    fuel_odometer_km = forms.IntegerField(label="Km no abastecimento", widget=forms.NumberInput(attrs={"inputmode": "numeric"}))
    fuel_liters = forms.DecimalField(label="Litros", min_value=0, decimal_places=3, widget=forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.001"}))
    fuel_total_price = forms.DecimalField(label="Total", min_value=0, decimal_places=2, widget=forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}))

    service_date = forms.DateField(label="Data do último serviço", widget=forms.DateInput(attrs={"type": "date"}))
    service_odometer_km = forms.IntegerField(label="Km no serviço", widget=forms.NumberInput(attrs={"inputmode": "numeric"}))
    service_cost = forms.DecimalField(label="Custo do serviço", min_value=0, decimal_places=2, widget=forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}))

    front_tire = forms.CharField(label="Pneu dianteiro", max_length=120)
    rear_tire = forms.CharField(label="Pneu traseiro", max_length=120)
    tire_installed_at = forms.DateField(label="Data dos pneus", widget=forms.DateInput(attrs={"type": "date"}))
    tire_odometer_km = forms.IntegerField(label="Km dos pneus", widget=forms.NumberInput(attrs={"inputmode": "numeric"}))

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        today = timezone.localdate()
        self.fields["riding_profile"].initial = RidingProfile.AUTO
        self.fields["fuel_date"].initial = today
        self.fields["service_date"].initial = today
        self.fields["tire_installed_at"].initial = today
        for field in self.visible_fields():
            if field.field.required:
                field.field.widget.attrs["aria-required"] = "true"

    def clean(self):
        cleaned_data = super().clean()
        today = timezone.localdate()
        for field_name in ["fuel_date", "service_date", "tire_installed_at"]:
            if cleaned_data.get(field_name) and cleaned_data[field_name] > today:
                self.add_error(field_name, "A data não pode estar no futuro.")
        current = cleaned_data.get("current_odometer_km")
        for field_name in ["fuel_odometer_km", "service_odometer_km", "tire_odometer_km"]:
            value = cleaned_data.get(field_name)
            if current is not None and value is not None and value > current:
                self.add_error(field_name, "O km inicial não pode ser maior que o km atual.")
        return cleaned_data
