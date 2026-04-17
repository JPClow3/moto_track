from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from .forms import MotorcycleForm, MotorcycleSpecForm
from .models import Motorcycle, MotorcycleSpec


@login_required
def garage_list_view(request):
    motorcycles = Motorcycle.objects.filter(owner=request.user, is_active=True).order_by(
        "name"
    )  # pylint: disable=no-member
    return render(request, "garage/list.html", {"motorcycles": motorcycles})


@login_required
def garage_create_view(request):
    if request.method == "POST":
        form = MotorcycleForm(request.POST, request.FILES)
        if form.is_valid():
            motorcycle = form.save(commit=False)
            motorcycle.owner = request.user
            motorcycle.save()
            messages.success(request, f"Moto {motorcycle.name} cadastrada com sucesso.")
            return redirect("garage:list")
    else:
        form = MotorcycleForm()

    context = {
        "form": form,
        "title": "Adicionar moto",
        "submit_label": "Salvar moto",
    }
    return render(request, "garage/form.html", context)


@login_required
def garage_update_view(request, pk):
    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user, is_active=True)

    if request.method == "POST":
        form = MotorcycleForm(request.POST, request.FILES, instance=motorcycle)
        if form.is_valid():
            form.save()
            messages.success(request, f"Moto {motorcycle.name} atualizada com sucesso.")
            return redirect("garage:list")
    else:
        form = MotorcycleForm(instance=motorcycle)

    context = {
        "form": form,
        "title": f"Editar {motorcycle.name}",
        "submit_label": "Salvar alterações",
        "motorcycle": motorcycle,
    }
    return render(request, "garage/form.html", context)


@login_required
def garage_spec_update_view(request, pk):
    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user, is_active=True)
    spec, _ = MotorcycleSpec.objects.get_or_create(motorcycle=motorcycle)

    if request.method == "POST":
        form = MotorcycleSpecForm(request.POST, instance=spec)
        if form.is_valid():
            form.save()
            messages.success(request, f"Especificações de {motorcycle.name} atualizadas com sucesso.")
            return redirect("garage:list")
    else:
        form = MotorcycleSpecForm(instance=spec)

    return render(
        request,
        "garage/spec_form.html",
        {
            "form": form,
            "motorcycle": motorcycle,
            "title": f"Especificações de {motorcycle.name}",
            "submit_label": "Salvar especificações",
        },
    )


@login_required
def garage_delete_view(request, pk):
    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user, is_active=True)

    if request.method == "POST":
        name = motorcycle.name
        motorcycle.deactivate()
        messages.success(request, f"Moto {name} arquivada com sucesso.")
        return redirect("garage:list")

    return render(request, "garage/confirm_delete.html", {"motorcycle": motorcycle})
