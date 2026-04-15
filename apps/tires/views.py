from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from .forms import TireRecordForm
from .models import TirePosition, TireRecord
from .models import TireProduct
from apps.core.pagination import paginate


@login_required
def tire_catalog_view(request):
    products = TireProduct.objects.filter(owner=request.user)  # pylint: disable=no-member
    return render(request, "tires/catalogs.html", {"products": products})


def _build_tire_telemetry(record: TireRecord | None):
    if not record:
        return None

    wear = int(record.wear_percent or 0)
    wear = max(0, min(100, wear))

    # SVG circle: r=88 => circumference ≈ 2πr
    circumference = 552.92
    dash_offset = round(circumference * (1 - (wear / 100)), 2)

    if wear >= 70:
        status_label = "Atenção"
        status_tone = "warning"
        ring_class = "text-warning"
        status_icon = "triangle-alert"
    elif wear >= 40:
        status_label = "Monitorar"
        status_tone = "neutral"
        ring_class = "text-info"
        status_icon = "activity"
    else:
        status_label = "Saudável"
        status_tone = "good"
        ring_class = "text-success"
        status_icon = "check-circle-2"

    image_url = None
    if record.tire_product and record.tire_product.image:
        image_url = record.tire_product.image.url

    return {
        "record": record,
        "wear_percent": wear,
        "circumference": circumference,
        "dash_offset": dash_offset,
        "status_label": status_label,
        "status_tone": status_tone,
        "ring_class": ring_class,
        "status_icon": status_icon,
        "image_url": image_url,
    }


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

    front_active = (
        records_qs.filter(is_active=True, position=TirePosition.FRONT)
        .order_by("-installed_at")
        .first()
    )
    rear_active = (
        records_qs.filter(is_active=True, position=TirePosition.REAR)
        .order_by("-installed_at")
        .first()
    )

    front_telemetry = _build_tire_telemetry(front_active)
    rear_telemetry = _build_tire_telemetry(rear_active)

    attention = any(
        t and t["status_tone"] == "warning" for t in [front_telemetry, rear_telemetry]
    )

    paged = paginate(request, records_qs, per_page=50)
    return render(
        request,
        "tires/list.html",
        {
            "records": paged.items,
            "page_obj": paged.page,
            "filters": {"motorcycle": motorcycle_id or ""},
            "front": front_telemetry,
            "rear": rear_telemetry,
            "has_attention": attention,
        },
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
