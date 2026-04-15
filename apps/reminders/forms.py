from django import forms

from apps.core.sanitizers import sanitize_text
from apps.garage.models import Motorcycle

from .models import Reminder


class ReminderForm(forms.ModelForm):
    class Meta:
        model = Reminder
        fields = [
            "motorcycle",
            "title",
            "description",
            "trigger_type",
            "trigger_value_km",
            "trigger_value_days",
            "reference_km",
            "reference_date",
            "is_active",
            "send_email",
            "notes",
        ]
        widgets = {
            "description": forms.Textarea(attrs={"rows": 2}),
            "notes": forms.Textarea(attrs={"rows": 2}),
            "reference_date": forms.DateInput(attrs={"type": "date"}),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user).order_by("name")
        self.fields["description"].required = False
        self.fields["trigger_value_km"].required = False
        self.fields["trigger_value_days"].required = False
        self.fields["reference_km"].required = False
        self.fields["reference_date"].required = False
        self.fields["notes"].required = False

        for field in self.visible_fields():
            if field.field.required:
                field.field.widget.attrs["aria-required"] = "true"

    def clean_description(self):
        return sanitize_text(self.cleaned_data.get("description"))

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))
