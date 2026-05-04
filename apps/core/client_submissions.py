from __future__ import annotations

import uuid

from apps.core.models import ClientSubmission


def client_submission_token_for_form(request) -> str:
    token = (request.POST.get("client_submission_id") or "").strip()
    return token or uuid.uuid4().hex


def completed_client_submission(request, *, action: str):
    token = (request.POST.get("client_submission_id") or "").strip()
    if not token or not request.user.is_authenticated:
        return None, token

    submission = ClientSubmission.objects.filter(owner=request.user, token=token).first()
    if (
        submission
        and submission.action == action
        and submission.result_model
        and submission.result_pk is not None
    ):
        return submission, token
    return None, token


def record_client_submission(request, *, token: str, action: str, result) -> None:
    token = (token or "").strip()
    if not token or not request.user.is_authenticated or result is None:
        return

    result_model = result._meta.label
    result_pk = result.pk
    defaults = {"action": action, "result_model": result_model, "result_pk": result_pk}
    ClientSubmission.objects.update_or_create(owner=request.user, token=token, defaults=defaults)
