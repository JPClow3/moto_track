from django.db import OperationalError, ProgrammingError


def billing_context(request):
    try:
        from apps.billing.entitlements import has_pro_access, plan_label, remaining_upload_slots
    except (OperationalError, ProgrammingError):
        return {}

    user = getattr(request, "user", None)
    if not getattr(user, "is_authenticated", False):
        return {"billing_plan_label": "Free", "billing_has_pro": False}
    try:
        return {
            "billing_plan_label": plan_label(user),
            "billing_has_pro": has_pro_access(user),
            "billing_remaining_upload_slots": remaining_upload_slots(user),
        }
    except (OperationalError, ProgrammingError):
        return {"billing_plan_label": "Free", "billing_has_pro": False}
