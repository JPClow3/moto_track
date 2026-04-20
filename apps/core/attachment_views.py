from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.contenttypes.models import ContentType
from django.shortcuts import get_object_or_404, redirect

from apps.core.exports import safe_next_url
from apps.core.models import RecordAttachment


def _object_owner(obj):
    if hasattr(obj, "owner"):
        return obj.owner
    motorcycle = getattr(obj, "motorcycle", None)
    if motorcycle is not None:
        return motorcycle.owner
    policy = getattr(obj, "policy", None)
    if policy is not None:
        return policy.motorcycle.owner
    return None


@login_required
def attachment_create_view(request, app_label: str, model: str, object_id: int):
    if request.method != "POST":
        return redirect(safe_next_url(request=request, candidate=request.GET.get("next"), fallback="dashboard"))

    content_type = get_object_or_404(ContentType, app_label=app_label, model=model)
    obj = get_object_or_404(content_type.model_class(), pk=object_id)
    if _object_owner(obj) != request.user:
        messages.error(request, "Você não pode anexar arquivos a este registro.")
        return redirect("dashboard")

    upload = request.FILES.get("file")
    if not upload:
        messages.error(request, "Selecione um arquivo para anexar.")
        return redirect(safe_next_url(request=request, candidate=request.POST.get("next"), fallback="dashboard"))

    attachment = RecordAttachment(owner=request.user, content_object=obj, file=upload, label=request.POST.get("label", ""))
    attachment.full_clean()
    attachment.save()
    messages.success(request, "Anexo salvo com sucesso.")
    return redirect(safe_next_url(request=request, candidate=request.POST.get("next"), fallback="dashboard"))


@login_required
def attachment_delete_view(request, pk: int):
    attachment = get_object_or_404(RecordAttachment, pk=pk, owner=request.user)
    if request.method != "POST":
        return redirect(safe_next_url(request=request, candidate=request.GET.get("next"), fallback="dashboard"))

    if attachment.file:
        attachment.file.delete(save=False)
    attachment.delete()
    messages.success(request, "Anexo removido com sucesso.")
    return redirect(safe_next_url(request=request, candidate=request.POST.get("next"), fallback="dashboard"))
