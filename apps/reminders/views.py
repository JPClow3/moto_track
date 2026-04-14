from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from .forms import ReminderForm
from .models import Reminder


@login_required
def reminder_list_view(request):
	active_reminders = Reminder.objects.filter(motorcycle__owner=request.user, is_active=True)
	inactive_reminders = Reminder.objects.filter(motorcycle__owner=request.user, is_active=False)
	context = {
		"active_reminders": active_reminders,
		"inactive_reminders": inactive_reminders,
	}
	return render(request, "reminders/list.html", context)


@login_required
def reminder_create_view(request):
	if request.method == "POST":
		form = ReminderForm(request.POST, user=request.user)
		if form.is_valid():
			reminder = form.save()
			messages.success(request, f"Lembrete {reminder.title} criado com sucesso.")
			return redirect("reminders:list")
	else:
		form = ReminderForm(user=request.user)

	context = {
		"form": form,
		"title": "Novo lembrete",
		"submit_label": "Salvar lembrete",
	}
	return render(request, "reminders/form.html", context)


@login_required
def reminder_update_view(request, pk):
	reminder = get_object_or_404(Reminder, pk=pk, motorcycle__owner=request.user)

	if request.method == "POST":
		form = ReminderForm(request.POST, instance=reminder, user=request.user)
		if form.is_valid():
			form.save()
			messages.success(request, f"Lembrete {reminder.title} atualizado com sucesso.")
			return redirect("reminders:list")
	else:
		form = ReminderForm(instance=reminder, user=request.user)

	context = {
		"form": form,
		"title": f"Editar {reminder.title}",
		"submit_label": "Salvar alterações",
		"reminder": reminder,
	}
	return render(request, "reminders/form.html", context)


@login_required
def reminder_delete_view(request, pk):
	reminder = get_object_or_404(Reminder, pk=pk, motorcycle__owner=request.user)

	if request.method == "POST":
		title = reminder.title
		reminder.delete()
		messages.success(request, f"Lembrete {title} removido com sucesso.")
		return redirect("reminders:list")

	return render(request, "reminders/confirm_delete.html", {"reminder": reminder})
