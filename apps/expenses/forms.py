from __future__ import annotations

from django import forms

from apps.core.sanitizers import sanitize_text
from apps.garage.models import Motorcycle

from .models import AnnualFee, InsuranceClaim, InsurancePolicy


class AnnualFeeForm(forms.ModelForm):
    class Meta:
        model = AnnualFee
        fields = [
            "motorcycle",
            "fee_type",
            "year",
            "due_date",
            "paid_date",
            "amount",
            "notify_before_days",
            "notes",
        ]
        labels = {
            "motorcycle": "Moto",
            "fee_type": "Tipo de taxa",
            "year": "Ano",
            "due_date": "Vencimento",
            "paid_date": "Data de pagamento",
            "amount": "Valor",
            "notify_before_days": "Avisar com antecedência (dias)",
            "notes": "Observações",
        }
        widgets = {
            "due_date": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "paid_date": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user, is_active=True).order_by(
            "name"
        )  # pylint: disable=no-member
        self.fields["paid_date"].required = False
        self.fields["notes"].required = False

        for field in self.visible_fields():
            if field.field.required:
                field.field.widget.attrs["aria-required"] = "true"

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))


class InsurancePolicyForm(forms.ModelForm):
    class Meta:
        model = InsurancePolicy
        fields = [
            "motorcycle",
            "provider",
            "policy_number",
            "coverage_start",
            "coverage_end",
            "premium",
            "notify_before_days",
            "notes",
        ]
        labels = {
            "motorcycle": "Moto",
            "provider": "Seguradora",
            "policy_number": "Número da apólice",
            "coverage_start": "Início da vigência",
            "coverage_end": "Fim da vigência",
            "premium": "Prêmio",
            "notify_before_days": "Avisar com antecedência (dias)",
            "notes": "Observações",
        }
        widgets = {
            "coverage_start": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "coverage_end": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user, is_active=True).order_by(
            "name"
        )  # pylint: disable=no-member
        self.fields["policy_number"].required = False
        self.fields["notes"].required = False

        for field in self.visible_fields():
            if field.field.required:
                field.field.widget.attrs["aria-required"] = "true"

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))


class InsuranceClaimForm(forms.ModelForm):
    class Meta:
        model = InsuranceClaim
        fields = ["claim_date", "status", "amount", "description"]
        labels = {
            "claim_date": "Data do sinistro",
            "status": "Status",
            "amount": "Valor",
            "description": "Descrição",
        }
        widgets = {
            "claim_date": forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"}),
            "description": forms.Textarea(attrs={"rows": 3}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["amount"].required = False

        for field in self.visible_fields():
            if field.field.required:
                field.field.widget.attrs["aria-required"] = "true"

    def clean_description(self):
        return sanitize_text(self.cleaned_data.get("description"))
