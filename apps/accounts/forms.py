from allauth.account.forms import SignupForm as AllauthSignupForm
from django import forms


class SignupForm(AllauthSignupForm):
    # Label intentionally kept plain — the signup template renders the policy
    # links as a separate stacked block so each link gets a real touch target
    # on mobile. Embedding `<a>` tags here used to produce a tangled wrap on
    # narrow viewports.
    accept_terms = forms.BooleanField(
        required=True,
        label="Li e aceito as políticas e termos abaixo.",
        error_messages={
            "required": (
                "Voce precisa aceitar a Politica de Privacidade, os Termos de Uso e "
                "a Politica de Cancelamento para criar a conta."
            ),
        },
    )
