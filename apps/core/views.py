import json

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.http import FileResponse, HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from apps.accounts.verification import user_needs_email_verification
from apps.billing.entitlements import has_pro_access
from apps.core.exports import safe_next_url
from apps.core.forms import OdometerOverrideForm
from apps.core.models import PushSubscription
from apps.core.services.dashboard import (
    get_active_reminders,
    get_catalog_links,
    get_chart_consumption_trend,
    get_chart_spending_distribution,
    get_dashboard_cards,
    get_monthly_sparkline,
    get_quick_actions,
    get_setup_progress,
    get_status_cards,
    get_tire_cards,
)
from apps.core.services.idempotency import (
    claim_client_submission,
    client_submission_token_for_form,
    completed_client_submission,
    record_client_submission,
)
from apps.core.undo import SESSION_KEY as UNDO_SESSION_KEY
from apps.core.undo import consume_undo_token
from apps.garage.active_motorcycle import get_active_motorcycle, set_active_motorcycle
from apps.reports.services import health_score, timeline_events
from apps.work.services import professional_summary


def _redirect_or_hx(request, next_url: str):
    if request.headers.get("HX-Request") == "true":
        response = HttpResponse()
        response["HX-Redirect"] = next_url
        return response
    return redirect(next_url)


def landing_view(request):
    if request.user.is_authenticated and not user_needs_email_verification(request.user):
        return redirect("dashboard")
    from apps.forum.models import ForumArticle

    latest_blog = ForumArticle.objects.filter(is_published=True).only(
        "title", "slug", "summary", "published_at"
    ).order_by("-published_at")[:3]
    return render(request, "core/landing.html", {"latest_blog": latest_blog})


@login_required
def dashboard_view(request):
    if request.method == "POST" and request.POST.get("active_motorcycle_id"):
        try:
            active_id = int(request.POST["active_motorcycle_id"])
        except (ValueError, TypeError):
            active_id = None
        if active_id is not None:
            set_active_motorcycle(request, active_id)
        next_url = safe_next_url(request=request, candidate=request.POST.get("next"), fallback=reverse("dashboard"))
        if request.headers.get("HX-Request"):
            response = HttpResponse()
            response["HX-Redirect"] = next_url
            return response
        return redirect(next_url)

    motorcycle = get_active_motorcycle(request)
    if not motorcycle:
        return redirect("onboarding")

    current_odometer_km = motorcycle.current_odometer_km
    monthly = get_monthly_sparkline(motorcycle)
    active_reminders = get_active_reminders(motorcycle, current_odometer_km)
    status_cards, pending_alerts = get_status_cards(motorcycle, current_odometer_km, active_reminders)

    setup_progress = get_setup_progress(motorcycle)
    professional = professional_summary(user=request.user, motorcycle=motorcycle)
    user_has_pro = has_pro_access(request.user)
    context = {
        "motorcycle": motorcycle,
        "status_cards": status_cards,
        "tire_cards": get_tire_cards(motorcycle),
        "quick_actions": get_quick_actions(),
        "catalog_links": get_catalog_links(),
        "active_reminders": active_reminders,
        "month_total": monthly["month_total"],
        "weekly_sparkline_points": monthly["weekly_sparkline_points"],
        "pending_alerts": pending_alerts,
        "cards": get_dashboard_cards(motorcycle, current_odometer_km, monthly["month_total"], pending_alerts),
        "chart_spending_distribution": get_chart_spending_distribution(motorcycle),
        "chart_consumption_trend": get_chart_consumption_trend(motorcycle),
        "health": health_score(motorcycle=motorcycle),
        "recent_events": timeline_events(user=request.user, motorcycle=motorcycle, limit=5),
        "setup_progress": setup_progress,
        "setup_incomplete": any(not v for v in setup_progress.values()),
        "professional_summary": professional,
        "has_pro": user_has_pro,
    }
    return render(request, "core/dashboard.html", context)


@login_required
def odometer_quick_update_view(request):
    motorcycle = get_active_motorcycle(request)
    is_htmx = request.headers.get("HX-Request") == "true"

    if not motorcycle:
        messages.error(request, "Cadastre uma moto antes de atualizar o odometro.")
        if is_htmx:
            response = HttpResponse()
            response["HX-Redirect"] = reverse("dashboard")
            return response
        return redirect("dashboard")

    current_odometer_km = motorcycle.current_odometer_km

    if request.method == "POST":
        completed, submission_token = completed_client_submission(request, action="quick_odometer_update")
        next_url = safe_next_url(
            request=request,
            candidate=request.GET.get("next") or request.POST.get("next"),
            fallback=reverse("dashboard"),
        )
        if completed:
            return _redirect_or_hx(request, next_url)
        form = OdometerOverrideForm(request.POST, motorcycle=motorcycle)
        if form.is_valid():
            with transaction.atomic():
                submission, should_process = claim_client_submission(
                    request,
                    token=submission_token,
                    action="quick_odometer_update",
                )
                if not should_process:
                    return _redirect_or_hx(request, next_url)
                updated = form.save()
                record_client_submission(
                    request,
                    token=submission_token,
                    action="quick_odometer_update",
                    result=updated,
                    submission=submission,
                )
            messages.success(request, "Odometro atualizado com sucesso.")
            return _redirect_or_hx(request, next_url)
        status = 422 if is_htmx else 200
    else:
        form = OdometerOverrideForm(
            motorcycle=motorcycle,
            initial={"odometer_override_km": current_odometer_km, "next": request.GET.get("next") or ""},
        )
        status = 200

    context = {
        "form": form,
        "title": "Atualizar odometro",
        "submit_label": "Salvar odometro",
        "next_url": safe_next_url(
            request=request,
            candidate=request.GET.get("next") or request.POST.get("next"),
            fallback=reverse("dashboard"),
        ),
        "client_submission_id": client_submission_token_for_form(request),
    }
    return render(request, "core/partials/odometer_form.html", context, status=status)


@login_required
def quick_add_selector_view(request):
    next_url = safe_next_url(request=request, candidate=request.GET.get("next"), fallback=reverse("dashboard"))
    return render(request, "core/partials/quick_add_selector.html", {"next_url": next_url})


def offline_view(request):
    response = render(request, "offline.html")
    response["Cache-Control"] = "public, max-age=3600"
    return response


def manifest_view(request):
    palettes = {
        "light": {"background_color": "#F5F5F4", "theme_color": "#F5F5F4"},
        "dark": {"background_color": "#09090B", "theme_color": "#09090B"},
    }
    mode = (request.GET.get("mode") or "system").strip().lower()
    resolved = (request.GET.get("resolved") or "").strip().lower()
    resolved_theme = resolved if resolved in palettes else ("dark" if mode == "dark" else "light")
    manifest = {
        "id": "/",
        "name": "Moto Track",
        "short_name": "Moto Track",
        "description": "Controle garagem, abastecimentos, manutencoes, pneus e documentos da sua moto.",
        "start_url": "/dashboard/?source=pwa",
        "scope": "/",
        "display": "standalone",
        "orientation": "portrait-primary",
        "categories": ["productivity", "utilities", "lifestyle"],
        "prefer_related_applications": False,
        **palettes[resolved_theme],
        "icons": [
            {
                "src": "/static/brand/web/android-chrome-192x192.png",
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": "/static/brand/web/android-chrome-512x512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any maskable",
            },
            {
                "src": "/static/brand/favicon-32x32.png",
                "sizes": "32x32",
                "type": "image/png",
                "purpose": "any",
            },
        ],
    }
    response = JsonResponse(manifest)
    response["Content-Type"] = "application/manifest+json"
    response["Cache-Control"] = "no-cache"
    return response


def pwa_status_view(request):
    return JsonResponse(
        {
            "authenticated": request.user.is_authenticated,
            "csrf_token": get_token(request),
            "login_url": reverse("account_login"),
        }
    )


def service_worker_view(request):
    response = FileResponse(
        open(settings.WHITENOISE_ROOT / "sw.js", "rb"),
        content_type="application/javascript",
    )
    response["Service-Worker-Allowed"] = "/"
    response["Cache-Control"] = "no-cache"
    return response


@login_required
def undo_action_view(request, token: str):
    if request.method != "POST":
        return redirect("dashboard")

    obj, error = consume_undo_token(request, token=token)
    next_url = safe_next_url(
        request=request,
        candidate=request.POST.get("next"),
        fallback="dashboard",
    )
    if error:
        messages.error(request, error)
        return redirect(next_url)

    if obj is None:
        messages.error(request, "Registro nao encontrado para desfazer.")
        return redirect(next_url)

    try:
        motorcycle = getattr(obj, "motorcycle", None)
        owner = getattr(motorcycle, "owner", None)
    except ObjectDoesNotExist:
        messages.error(request, "Registro nao encontrado para desfazer.")
        return redirect(next_url)
    if owner != request.user:
        messages.error(request, "Voce nao pode desfazer este registro.")
        return redirect("dashboard")

    label = str(obj)
    obj.delete()
    messages.success(request, f"Acao desfeita: {label}.")
    return redirect(next_url)


@login_required
@require_POST
def push_subscribe_view(request):
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            return JsonResponse({"error": "Invalid subscription data"}, status=400)
        endpoint = data.get("endpoint")
        keys = data.get("keys") or {}
        if not isinstance(keys, dict):
            keys = {}
        p256dh = keys.get("p256dh")
        auth = keys.get("auth")

        if not endpoint or not p256dh or not auth:
            return JsonResponse({"error": "Invalid subscription data"}, status=400)

        sub, created = PushSubscription.objects.update_or_create(
            owner=request.user,
            endpoint=endpoint,
            defaults={
                "p256dh": p256dh,
                "auth": auth
            }
        )
        return JsonResponse({"status": "ok", "created": created})
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)


@login_required
@require_POST
def theme_preference_view(request):
    from apps.accounts.models import UserPreference

    theme = request.POST.get("theme", "system").strip().lower()
    if theme not in ("system", "dark", "light"):
        return JsonResponse({"error": "Invalid theme"}, status=400)
    UserPreference.objects.update_or_create(
        user=request.user, defaults={"theme": theme}
    )
    return JsonResponse({"theme": theme})


@login_required
def message_list_view(request):
    from django.contrib.messages import get_messages

    undo_token = request.session.get("last_undo_token")
    undo_payload = request.session.get(UNDO_SESSION_KEY, {}).get(undo_token) if undo_token else None
    snackbar_undo = {"token": undo_token, **undo_payload} if undo_payload else None
    storage = get_messages(request)
    messages_list = list(storage)
    response = render(
        request,
        "core/partials/messages.html",
        {"messages": messages_list, "snackbar_undo": snackbar_undo},
    )
    storage.used = True
    return response
