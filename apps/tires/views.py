from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from .models import TireProduct


@login_required
def tire_catalog_view(request):
	products = TireProduct.objects.filter(owner=request.user)
	return render(request, "tires/catalogs.html", {"products": products})
