from allauth.account.forms import SignupForm as AllauthSignupForm
from django import forms
from django.utils.html import format_html


class SignupForm(AllauthSignupForm):
    accept_terms = forms.BooleanField(
        required=True,
        label=format_html(
            'Li e aceito a <a class="text-link" href="/politica" target="_blank" rel="noopener">'
            "Politica de Privacidade</a> e os "
            '<a class="text-link" href="/termos" target="_blank" rel="noopener">Termos de Servico</a>.'
        ),
        error_messages={
            "required": "Voce precisa aceitar a Politica de Privacidade e os Termos de Servico para criar a conta.",
        },
    )
