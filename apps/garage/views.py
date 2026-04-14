from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from .forms import MotorcycleForm
from .models import Motorcycle


@login_required
def garage_list_view(request):
	motorcycles = Motorcycle.objects.filter(owner=request.user).order_by("name")
	return render(request, "garage/list.html", {"motorcycles": motorcycles})


@login_required
def garage_create_view(request):
	if request.method == "POST":
		form = MotorcycleForm(request.POST)
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
	motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user)

	if request.method == "POST":
		form = MotorcycleForm(request.POST, instance=motorcycle)
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
def garage_delete_view(request, pk):
	motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user)

	if request.method == "POST":
		name = motorcycle.name
		motorcycle.delete()
		messages.success(request, f"Moto {name} removida com sucesso.")
		return redirect("garage:list")

	return render(request, "garage/confirm_delete.html", {"motorcycle": motorcycle})
