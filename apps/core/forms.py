from dal import autocomplete
from django import forms
from django.db.models import Max
from django.utils import timezone

from apps.core.sanitizers import sanitize_text
from apps.garage.models import MotorcycleTemplate, RidingProfile


def _resolve_template_year(template: MotorcycleTemplate) -> int:
    current_year = timezone.localdate().year
    if template.year_to is None:
        return max(template.year_from, current_year)
    return max(template.year_from, min(current_year, template.year_to))


class MinimalOnboardingForm(forms.Form):
    template = forms.ModelChoiceField(
        label="Template da moto (opcional)",
        queryset=MotorcycleTemplate.objects.none(),
        required=False,
        widget=autocomplete.ModelSelect2(url="onboarding_template_autocomplete"),
        help_text="Busque por marca/modelo/ano. Se não encontrar, preencha manualmente.",
    )
    template_not_listed = forms.BooleanField(
        label="Minha moto não está na lista",
        required=False,
    )

    motorcycle_name = forms.CharField(label="Nome da moto", max_length=120)
    brand = forms.CharField(label="Marca", max_length=80)
    model = forms.CharField(label="Modelo", max_length=120)
    year = forms.IntegerField(
        label="Ano",
        min_value=1900,
        widget=forms.NumberInput(attrs={"inputmode": "numeric"}),
    )
    current_odometer_km = forms.IntegerField(
        label="Km atual",
        min_value=0,
        widget=forms.NumberInput(attrs={"inputmode": "numeric"}),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["template"].queryset = MotorcycleTemplate.objects.order_by("brand", "model", "year_from")
        for field in self.visible_fields():
            if field.field.required:
                field.field.widget.attrs["aria-required"] = "true"
        for name in ["brand", "model"]:
            self.fields[name].widget.attrs.setdefault("autocomplete", "off")
        self._apply_template_defaults()

    def _resolve_selected_template(self) -> MotorcycleTemplate | None:
        template_id = None
        if self.is_bound:
            template_id = self.data.get("template")
        else:
            initial_template = self.initial.get("template")
            if hasattr(initial_template, "pk"):
                template_id = initial_template.pk
            else:
                template_id = initial_template
        if not template_id:
            return None
        try:
            template_id = int(template_id)
        except (ValueError, TypeError):
            return None
        return MotorcycleTemplate.objects.select_related("spec").filter(pk=template_id).first()

    def _apply_template_defaults(self):
        template = self._resolve_selected_template()
        if not template or self.is_bound:
            return
        self.fields["brand"].initial = template.brand
        self.fields["model"].initial = template.model
        default_year = _resolve_template_year(template)
        self.fields["year"].initial = default_year

    def clean_motorcycle_name(self):
        value = sanitize_text(self.cleaned_data.get("motorcycle_name"))
        if not value:
            raise forms.ValidationError("Informe o nome da moto.")
        return value

    def clean_brand(self):
        value = sanitize_text(self.cleaned_data.get("brand"))
        if not value:
            raise forms.ValidationError("Informe a marca da moto.")
        return value

    def clean_model(self):
        value = sanitize_text(self.cleaned_data.get("model"))
        if not value:
            raise forms.ValidationError("Informe o modelo da moto.")
        return value

    def clean(self):
        cleaned_data = super().clean()
        if cleaned_data.get("template_not_listed"):
            cleaned_data["template"] = None
        if not cleaned_data.get("brand") and "brand" not in self.errors:
            self.add_error("brand", "Informe a marca da moto.")
        if not cleaned_data.get("model") and "model" not in self.errors:
            self.add_error("model", "Informe o modelo da moto.")
        template = cleaned_data.get("template")
        year = cleaned_data.get("year")
        if template and year:
            valid = (year >= template.year_from) and (template.year_to is None or year <= template.year_to)
            if not valid:
                self.add_error(
                    "year",
                    f"Ano fora do intervalo do template: {template.year_from} a {template.year_to or 'atual'}.",
                )
        return cleaned_data


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

        from apps.garage.services import recompute_motorcycle_odometer

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
    SPEC_FIELD_NAMES = [
        "fuel_tank_capacity_l",
        "fuel_type_recommendation",
        "fuel_octane_min",
        "oil_capacity_l",
        "oil_type_recommendation",
        "oil_viscosity_recommendation",
        "tire_size_front",
        "tire_size_rear",
        "tire_speed_rating",
        "recommended_tire_pressure_front",
        "recommended_tire_pressure_rear",
        "battery_spec",
        "chain_size",
        "manual_reference",
    ]

    template = forms.ModelChoiceField(
        label="Template da moto",
        queryset=MotorcycleTemplate.objects.none(),
        required=False,
        widget=autocomplete.ModelSelect2(url="onboarding_template_autocomplete"),
        help_text="Busque por marca/modelo/ano. Se não encontrar, marque a opção abaixo.",
    )
    template_not_listed = forms.BooleanField(
        label="Minha moto não está na lista",
        required=False,
    )
    template_variant = forms.CharField(
        label="Variante do exemplar",
        max_length=80,
        required=False,
        help_text="Ex.: ABS, carburada, importada.",
    )

    motorcycle_name = forms.CharField(label="Nome da moto", max_length=120)
    brand = forms.CharField(label="Marca", max_length=80, required=False)
    model = forms.CharField(label="Modelo", max_length=120, required=False)
    year = forms.IntegerField(
        label="Ano",
        min_value=1900,
        required=False,
        widget=forms.NumberInput(attrs={"inputmode": "numeric"}),
    )
    current_odometer_km = forms.IntegerField(
        label="Km atual",
        min_value=0,
        widget=forms.NumberInput(attrs={"inputmode": "numeric"}),
    )
    riding_profile = forms.ChoiceField(label="Perfil de condução", choices=RidingProfile.choices, required=False)

    fuel_tank_capacity_l = forms.DecimalField(
        label="Capacidade do tanque (L)",
        min_value=0,
        decimal_places=2,
        required=False,
        widget=forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
    )
    fuel_type_recommendation = forms.CharField(label="Combustível recomendado", max_length=80, required=False)
    fuel_octane_min = forms.IntegerField(
        label="Octanagem mínima",
        min_value=0,
        required=False,
        widget=forms.NumberInput(attrs={"inputmode": "numeric"}),
    )
    oil_capacity_l = forms.DecimalField(
        label="Capacidade de óleo (L)",
        min_value=0,
        decimal_places=2,
        required=False,
        widget=forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
    )
    oil_type_recommendation = forms.CharField(label="Óleo recomendado", max_length=80, required=False)
    oil_viscosity_recommendation = forms.CharField(label="Viscosidade do óleo", max_length=32, required=False)
    tire_size_front = forms.CharField(label="Medida do pneu dianteiro", max_length=32, required=False)
    tire_size_rear = forms.CharField(label="Medida do pneu traseiro", max_length=32, required=False)
    tire_speed_rating = forms.CharField(label="Índice de velocidade", max_length=8, required=False)
    recommended_tire_pressure_front = forms.CharField(
        label="Pressão dianteira recomendada",
        max_length=32,
        required=False,
    )
    recommended_tire_pressure_rear = forms.CharField(
        label="Pressão traseira recomendada",
        max_length=32,
        required=False,
    )
    battery_spec = forms.CharField(label="Especificação da bateria", max_length=80, required=False)
    chain_size = forms.CharField(label="Medida da relação/corrente", max_length=32, required=False)
    manual_reference = forms.CharField(label="Referência do manual", max_length=120, required=False)

    fuel_date = forms.DateField(
        label="Data do ultimo abastecimento",
        required=False,
        help_text="Opcional — pode ser preenchido depois.",
        widget=forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
    )
    fuel_odometer_km = forms.IntegerField(
        label="Km no abastecimento",
        required=False,
        help_text="Km do hodômetro no momento do abastecimento.",
        widget=forms.NumberInput(attrs={"inputmode": "numeric"}),
    )
    fuel_liters = forms.DecimalField(
        label="Litros",
        min_value=0.01,
        decimal_places=3,
        required=False,
        widget=forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.001"}),
    )
    fuel_total_price = forms.DecimalField(
        label="Total",
        min_value=0,
        decimal_places=2,
        required=False,
        widget=forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
    )

    service_date = forms.DateField(
        label="Data do último serviço",
        required=False,
        help_text="Opcional — pode ser preenchido depois.",
        widget=forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
    )
    service_odometer_km = forms.IntegerField(
        label="Km no serviço",
        required=False,
        widget=forms.NumberInput(attrs={"inputmode": "numeric"}),
    )
    service_cost = forms.DecimalField(
        label="Custo do serviço",
        min_value=0,
        decimal_places=2,
        required=False,
        widget=forms.NumberInput(attrs={"inputmode": "decimal", "step": "0.01"}),
    )

    front_tire = forms.CharField(label="Pneu dianteiro", max_length=120, required=False)
    rear_tire = forms.CharField(label="Pneu traseiro", max_length=120, required=False)
    tire_installed_at = forms.DateField(
        label="Data dos pneus",
        required=False,
        help_text="Opcional — pode ser preenchido depois.",
        widget=forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
    )
    tire_odometer_km = forms.IntegerField(
        label="Km dos pneus",
        required=False,
        widget=forms.NumberInput(attrs={"inputmode": "numeric"}),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["template"].queryset = MotorcycleTemplate.objects.order_by("brand", "model", "year_from")
        self.selected_template = self._resolve_selected_template()

        today = timezone.localdate()
        self.fields["riding_profile"].initial = RidingProfile.AUTO
        self.fields["fuel_date"].initial = today
        self.fields["service_date"].initial = today
        self.fields["tire_installed_at"].initial = today
        for field in self.visible_fields():
            if field.field.required:
                field.field.widget.attrs["aria-required"] = "true"

        for name in ["template_variant", "brand", "model", "manual_reference"]:
            self.fields[name].widget.attrs.setdefault("autocomplete", "off")

        self._apply_template_defaults()

    def _resolve_selected_template(self) -> MotorcycleTemplate | None:
        template_id = None
        if self.is_bound:
            template_id = self.data.get("template")
        else:
            initial_template = self.initial.get("template")
            if hasattr(initial_template, "pk"):
                template_id = initial_template.pk
            else:
                template_id = initial_template
        if not template_id:
            return None
        try:
            template_id = int(template_id)
        except (ValueError, TypeError):
            return None
        return MotorcycleTemplate.objects.select_related("spec").filter(pk=template_id).first()

    def _apply_template_defaults(self):
        if not self.selected_template:
            return

        template = self.selected_template
        default_year = _resolve_template_year(template)

        if not self.is_bound:
            self.fields["brand"].initial = template.brand
            self.fields["model"].initial = template.model
            self.fields["year"].initial = default_year
            if template.variant:
                self.fields["template_variant"].initial = template.variant

        spec = getattr(template, "spec", None)
        if not spec:
            return

        for field_name in self.SPEC_FIELD_NAMES:
            value = getattr(spec, field_name, None)
            if value in (None, ""):
                continue
            if not self.is_bound:
                self.fields[field_name].initial = value
            widget = self.fields[field_name].widget
            widget.attrs["data-prefilled-by-catalog"] = "1"
            widget.attrs["data-prefilled-value"] = str(value)

    def clean_motorcycle_name(self):
        return sanitize_text(self.cleaned_data.get("motorcycle_name"))

    def clean_brand(self):
        return sanitize_text(self.cleaned_data.get("brand"))

    def clean_model(self):
        return sanitize_text(self.cleaned_data.get("model"))

    def clean_template_variant(self):
        return sanitize_text(self.cleaned_data.get("template_variant"))

    def clean_fuel_type_recommendation(self):
        return sanitize_text(self.cleaned_data.get("fuel_type_recommendation"))

    def clean_oil_type_recommendation(self):
        return sanitize_text(self.cleaned_data.get("oil_type_recommendation"))

    def clean_oil_viscosity_recommendation(self):
        return sanitize_text(self.cleaned_data.get("oil_viscosity_recommendation"))

    def clean_tire_size_front(self):
        return sanitize_text(self.cleaned_data.get("tire_size_front"))

    def clean_tire_size_rear(self):
        return sanitize_text(self.cleaned_data.get("tire_size_rear"))

    def clean_tire_speed_rating(self):
        return sanitize_text(self.cleaned_data.get("tire_speed_rating"))

    def clean_recommended_tire_pressure_front(self):
        return sanitize_text(self.cleaned_data.get("recommended_tire_pressure_front"))

    def clean_recommended_tire_pressure_rear(self):
        return sanitize_text(self.cleaned_data.get("recommended_tire_pressure_rear"))

    def clean_battery_spec(self):
        return sanitize_text(self.cleaned_data.get("battery_spec"))

    def clean_chain_size(self):
        return sanitize_text(self.cleaned_data.get("chain_size"))

    def clean_manual_reference(self):
        return sanitize_text(self.cleaned_data.get("manual_reference"))

    def clean_front_tire(self):
        return sanitize_text(self.cleaned_data.get("front_tire"))

    def clean_rear_tire(self):
        return sanitize_text(self.cleaned_data.get("rear_tire"))

    def clean(self):
        cleaned_data = super().clean()
        today = timezone.localdate()

        if cleaned_data.get("template_not_listed"):
            cleaned_data["template"] = None

        template = cleaned_data.get("template")
        year = cleaned_data.get("year")
        if template and year is not None:
            if year < template.year_from or (template.year_to is not None and year > template.year_to):
                self.add_error("year", "O ano informado deve estar dentro do intervalo do template selecionado.")

        if template and not cleaned_data.get("brand"):
            cleaned_data["brand"] = template.brand
        if template and not cleaned_data.get("model"):
            cleaned_data["model"] = template.model
        if template and cleaned_data.get("year") is None:
            cleaned_data["year"] = _resolve_template_year(template)

        if not cleaned_data.get("brand") and "brand" not in self.errors:
            self.add_error("brand", "Informe a marca da moto.")
        if not cleaned_data.get("model") and "model" not in self.errors:
            self.add_error("model", "Informe o modelo da moto.")
        if cleaned_data.get("year") is None and "year" not in self.errors:
            self.add_error("year", "Informe o ano da moto.")

        for field_name in ["fuel_date", "service_date", "tire_installed_at"]:
            if cleaned_data.get(field_name) and cleaned_data[field_name] > today:
                self.add_error(field_name, "A data não pode estar no futuro.")

        current = cleaned_data.get("current_odometer_km")
        for field_name in ["fuel_odometer_km", "service_odometer_km", "tire_odometer_km"]:
            value = cleaned_data.get(field_name)
            if current is not None and value is not None and value > current:
                self.add_error(field_name, "O km inicial não pode ser maior que o km atual.")
        return cleaned_data

    def spec_payload(self) -> dict:
        payload = {}
        for field_name in self.SPEC_FIELD_NAMES:
            payload[field_name] = self.cleaned_data.get(field_name)
        return payload
