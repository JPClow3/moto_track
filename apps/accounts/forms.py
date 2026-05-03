from allauth.account.forms import SignupForm as AllauthSignupForm
from django import forms
from django.utils.html import format_html


class SignupForm(AllauthSignupForm):
    accept_terms = forms.BooleanField(
        required=True,
        label=format_html(
            'Li e aceito a <a class="text-link" href="{}" target="_blank" rel="noopener">'
            'Politica de Privacidade</a>, os '
            '<a class="text-link" href="{}" target="_blank" rel="noopener">Termos de Uso</a> e a '
            '<a class="text-link" href="{}" target="_blank" rel="noopener">Politica de Cancelamento</a>.',
            "/politica/",
            "/termos/",
            "/cancelamento/",
        ),
        error_messages={
            "required": "Voce precisa aceitar a Politica de Privacidade, os Termos de Uso e a Politica de Cancelamento para criar a conta.",
        },
    )
