from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class UserPreference(models.Model):
    THEME_CHOICES = [
        ("system", "Sistema"),
        ("dark", "Escuro"),
        ("light", "Claro"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="preference")
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default="system")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_user_preference"

    def __str__(self):
        return f"Preferências de {self.user.username}"
