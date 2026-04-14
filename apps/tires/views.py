from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from .forms import TireRecordForm
from .models import TireRecord
from .models import TireProduct
from apps.core.pagination import paginate


@login_required
def tire_catalog_view(request):
    products = TireProduct.objects.filter(owner=request.user)  # pylint: disable=no-member
    return render(request, "tires/catalogs.html", {"products": products})


@login_required
def tire_list_view(request):
    records_qs = (
        TireRecord.objects.filter(motorcycle__owner=request.user)  # pylint: disable=no-member
        .select_related("motorcycle", "tire_product")
        .order_by("-installed_at")
    )
    motorcycle_id = request.GET.get("motorcycle")
    if motorcycle_id:
        records_qs = records_qs.filter(motorcycle_id=motorcycle_id)

    paged = paginate(request, records_qs, per_page=50)
    return render(
        request,
        "tires/list.html",
        {"records": paged.items, "page_obj": paged.page, "filters": {"motorcycle": motorcycle_id or ""}},
    )


@login_required
def tire_create_view(request):
    if request.method == "POST":
        form = TireRecordForm(request.POST, user=request.user)
        if form.is_valid():
            record = form.save()
            messages.success(request, f"Pneu {record.brand_model} registrado com sucesso.")
            return redirect("tires:list")
    else:
        form = TireRecordForm(user=request.user)

    context = {
        "form": form,
        "title": "Adicionar pneu",
        "submit_label": "Salvar pneu",
    }
    return render(request, "tires/form.html", context)


@login_required
def tire_update_view(request, pk):
    record = get_object_or_404(TireRecord, pk=pk, motorcycle__owner=request.user)  # pylint: disable=no-member

    if request.method == "POST":
        form = TireRecordForm(request.POST, instance=record, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, f"Pneu {record.brand_model} atualizado com sucesso.")
            return redirect("tires:list")
    else:
        form = TireRecordForm(instance=record, user=request.user)

    context = {
        "form": form,
        "title": f"Editar {record.brand_model}",
        "submit_label": "Salvar alterações",
        "record": record,
    }
    return render(request, "tires/form.html", context)


@login_required
def tire_delete_view(request, pk):
    record = get_object_or_404(TireRecord, pk=pk, motorcycle__owner=request.user)  # pylint: disable=no-member

    if request.method == "POST":
        label = record.brand_model
        record.delete()
        messages.success(request, f"Pneu {label} removido com sucesso.")
        return redirect("tires:list")

    return render(request, "tires/confirm_delete.html", {"record": record})
