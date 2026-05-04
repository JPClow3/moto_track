from functools import wraps
from urllib.parse import urlencode

from django.contrib import messages
from django.shortcuts import redirect
from django.urls import reverse

from .entitlements import has_pro_access


def pro_required(feature_label: str):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if has_pro_access(request.user):
                return view_func(request, *args, **kwargs)
            messages.info(request, f"{feature_label} faz parte do Plano Pro.")
            query = urlencode({"next": request.get_full_path()})
            return redirect(f"{reverse('pricing')}?{query}")

        return wrapped

    return decorator
