from django import forms

from apps.core.sanitizers import sanitize_text
from apps.garage.models import Motorcycle

from .models import MotorcycleDocument


class DocumentUploadForm(forms.ModelForm):
    class Meta:
        model = MotorcycleDocument
        fields = ["motorcycle", "name", "document_type", "file", "notes"]
        widgets = {
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user).order_by("name")
        self.fields["notes"].required = False

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))
