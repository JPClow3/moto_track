from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect, render

from .forms import DocumentUploadForm
from .models import DocumentType, MotorcycleDocument
from apps.core.pagination import paginate


@login_required
def list_documents(request):
	documents_qs = MotorcycleDocument.objects.select_related("motorcycle").filter(motorcycle__owner=request.user)

	if request.method == "POST":
		form = DocumentUploadForm(request.POST, request.FILES, user=request.user)
		if form.is_valid():
			doc = form.save()
			messages.success(request, f"Documento '{doc.name}' enviado com sucesso.")
			return redirect("documents:list")
	else:
		form = DocumentUploadForm(user=request.user)

	documents = documents_qs.order_by("-created_at", "name")
	paged = paginate(request, documents, per_page=50)
	pinned_manual = documents_qs.filter(document_type=DocumentType.MANUAL).order_by("-created_at").first()
	insurance_alert = documents_qs.filter(document_type=DocumentType.INSURANCE).order_by("-created_at").first()
	category_counts = dict(
		documents_qs.values("document_type").annotate(total=Count("id")).values_list("document_type", "total")
	)
	category_cards = [
		{"label": "Registro", "type": DocumentType.CRLV, "count": category_counts.get(DocumentType.CRLV, 0), "icon": "id-card"},
		{
			"label": "Seguro",
			"type": DocumentType.INSURANCE,
			"count": category_counts.get(DocumentType.INSURANCE, 0),
			"icon": "shield-check",
		},
		{"label": "Manuais", "type": DocumentType.MANUAL, "count": category_counts.get(DocumentType.MANUAL, 0), "icon": "book-open"},
		{"label": "Recibos", "type": DocumentType.RECEIPT, "count": category_counts.get(DocumentType.RECEIPT, 0), "icon": "receipt"},
	]

	context = {
		"documents": paged.items,
		"page_obj": paged.page,
		"upload_form": form,
		"pinned_manual": pinned_manual,
		"insurance_alert": insurance_alert,
		"category_counts": category_counts,
		"category_cards": category_cards,
	}
	return render(request, "documents/list.html", context)


@login_required
def delete_document(request, pk: int):
	document = get_object_or_404(MotorcycleDocument, pk=pk, motorcycle__owner=request.user)
	if request.method != "POST":
		return redirect("documents:list")

	name = document.name
	# Delete storage file first, then row.
	if document.file:
		document.file.delete(save=False)
	document.delete()
	messages.success(request, f"Documento '{name}' removido com sucesso.")
	return redirect("documents:list")
