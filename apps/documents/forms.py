import os

from django import forms
from django.core.exceptions import ValidationError

from apps.core.sanitizers import sanitize_text
from apps.garage.models import Motorcycle

from .models import MotorcycleDocument


class DocumentUploadForm(forms.ModelForm):
    ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".doc"]
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

    class Meta:
        model = MotorcycleDocument
        fields = ["motorcycle", "name", "document_type", "file", "valid_until", "notify_before_days", "notes"]
        labels = {
            "motorcycle": "Moto",
            "name": "Nome",
            "document_type": "Tipo de documento",
            "file": "Arquivo",
            "valid_until": "Validade",
            "notify_before_days": "Avisar com antecedência (dias)",
            "notes": "Observações",
        }
        widgets = {
            "file": forms.ClearableFileInput(attrs={"accept": "image/*,.pdf,.doc,.docx"}),
            "valid_until": forms.DateInput(attrs={"type": "date"}),
            "notes": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["motorcycle"].queryset = Motorcycle.objects.filter(owner=user).order_by("name")  # pylint: disable=no-member
        self.fields["notes"].required = False
        self.fields["valid_until"].required = False

    def clean_notify_before_days(self):
        value = self.cleaned_data.get("notify_before_days")
        if value is not None and value <= 0:
            raise ValidationError("O aviso deve ser maior que zero.")
        return value

    def clean_name(self):
        return sanitize_text(self.cleaned_data.get("name"))

    def clean_notes(self):
        return sanitize_text(self.cleaned_data.get("notes"))

    def clean_file(self):
        file = self.cleaned_data.get("file")
        if not file:
            return file

        ext = os.path.splitext(file.name)[1].lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            raise ValidationError(f"Extensão de arquivo não permitida. Use: {', '.join(self.ALLOWED_EXTENSIONS)}")

        if file.size > self.MAX_FILE_SIZE:
            raise ValidationError("O arquivo deve ter no máximo 10MB.")

        return file
