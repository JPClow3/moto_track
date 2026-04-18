from datetime import timedelta

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from apps.core.forms import configure_form_accessibility
from apps.core.pagination import paginate
from apps.core.exports import parse_date_param
from apps.core.ui import get_density, per_page_for_density
from apps.reminders.models import Reminder, TriggerType

from .forms import DocumentUploadForm
from .models import DocumentType, MotorcycleDocument
from .export import build_export


@login_required
def list_documents(request):
    documents_qs = MotorcycleDocument.objects.select_related("motorcycle").filter(
        motorcycle__owner=request.user, motorcycle__is_active=True
    )

    if request.method == "POST":
        form = DocumentUploadForm(request.POST, request.FILES, user=request.user)
        if form.is_valid():
            doc = form.save()
            messages.success(request, f"Documento '{doc.name}' enviado com sucesso.")
            return redirect("documents:list")
    else:
        form = DocumentUploadForm(user=request.user)

    documents = documents_qs.order_by("-created_at", "name")
    density = get_density(request)
    paged = paginate(request, documents, per_page=per_page_for_density(density))
    pinned_manual = documents_qs.filter(document_type=DocumentType.MANUAL).order_by("-created_at").first()
    insurance_alert = documents_qs.filter(document_type=DocumentType.INSURANCE).order_by("-created_at").first()
    category_counts = dict(
        documents_qs.values("document_type").annotate(total=Count("id")).values_list("document_type", "total")
    )
    category_cards = [
        {
            "label": "Registro",
            "type": DocumentType.CRLV,
            "count": category_counts.get(DocumentType.CRLV, 0),
            "icon": "id-card",
        },
        {
            "label": "Seguro",
            "type": DocumentType.INSURANCE,
            "count": category_counts.get(DocumentType.INSURANCE, 0),
            "icon": "shield-check",
        },
        {
            "label": "Manuais",
            "type": DocumentType.MANUAL,
            "count": category_counts.get(DocumentType.MANUAL, 0),
            "icon": "book-open",
        },
        {
            "label": "Recibos",
            "type": DocumentType.RECEIPT,
            "count": category_counts.get(DocumentType.RECEIPT, 0),
            "icon": "receipt",
        },
    ]
    configure_form_accessibility(form)

    context = {
        "documents": paged.items,
        "page_obj": paged.page,
        "upload_form": form,
        "pinned_manual": pinned_manual,
        "insurance_alert": insurance_alert,
        "category_counts": category_counts,
        "category_cards": category_cards,
        "density": density,
    }
    return render(request, "documents/list.html", context)


@login_required
def delete_document(request, pk: int):
    document = get_object_or_404(MotorcycleDocument, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method != "POST":
        return redirect("documents:list")

    name = document.name
    # Delete storage file first, then row.
    if document.file:
        document.file.delete(save=False)
    document.delete()
    messages.success(request, f"Documento '{name}' removido com sucesso.")
    return redirect("documents:list")


@login_required
def document_export_view(request):
    fmt = (request.GET.get("format") or "csv").strip().lower()
    if fmt not in {"csv", "xlsx"}:
        fmt = "csv"
    start = parse_date_param(request.GET.get("start"))
    end = parse_date_param(request.GET.get("end"))
    email_to = request.user.email if request.GET.get("email") == "1" else None
    return build_export(user=request.user, start=start, end=end, fmt=fmt, email_to=email_to)


@login_required
def create_document_reminder(request, pk: int):
    document = get_object_or_404(MotorcycleDocument, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method != "POST":
        return redirect("documents:list")

    if not document.valid_until:
        messages.error(request, "Defina uma validade antes de criar um lembrete.")
        return redirect("documents:list")

    # Due date = valid_until. We model this as reference_date + trigger_value_days.
    reference_date = document.valid_until - timedelta(days=1)
    trigger_days = 1

    Reminder.objects.create(  # pylint: disable=no-member
        motorcycle=document.motorcycle,
        title=f"Vencimento: {document.name}",
        description=f"Documento {document.get_document_type_display()} vence em {document.valid_until}.",
        trigger_type=TriggerType.BY_DATE,
        trigger_value_days=trigger_days,
        reference_date=reference_date,
        is_active=True,
        send_email=True,
    )
    messages.success(request, "Lembrete criado.")
    return redirect("documents:list")
