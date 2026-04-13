from django.contrib.auth.decorators import login_required
from django.shortcuts import render

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
