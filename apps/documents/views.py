from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.shortcuts import redirect
from django.shortcuts import render

from .forms import DocumentUploadForm
from .models import DocumentType, MotorcycleDocument


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
	pinned_manual = documents_qs.filter(document_type=DocumentType.MANUAL).order_by("-created_at").first()
	insurance_alert = documents_qs.filter(document_type=DocumentType.INSURANCE).order_by("-created_at").first()
	category_counts = dict(
		documents_qs.values("document_type").annotate(total=Count("id")).values_list("document_type", "total")
	)

	context = {
		"documents": documents,
		"upload_form": form,
		"pinned_manual": pinned_manual,
		"insurance_alert": insurance_alert,
		"category_counts": category_counts,
	}
	return render(request, "documents/list.html", context)
