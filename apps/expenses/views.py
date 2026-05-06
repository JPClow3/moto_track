from __future__ import annotations

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render

from apps.billing.decorators import pro_required
from apps.core.forms import configure_form_accessibility
from apps.core.pagination import paginate
from apps.core.ui import get_density, per_page_for_density

from .export import build_export
from .forms import AnnualFeeForm, InsuranceClaimForm, InsurancePolicyForm
from .models import AnnualFee, InsuranceClaim, InsurancePolicy
from .services import (
    delete_fee_reminder,
    delete_policy_reminder,
    sync_fee_reminder,
    sync_policy_reminder,
)


@login_required
def expenses_list_view(request):
    q = (request.GET.get("q") or "").strip()
    motorcycle_id = request.GET.get("motorcycle") or ""
    density = get_density(request)
    per_page = per_page_for_density(density)

    fees_qs = (
        AnnualFee.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True)
        .select_related("motorcycle")
        .order_by("-due_date")
    )
    policies_qs = (
        InsurancePolicy.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True)
        .select_related("motorcycle")
        .order_by("-coverage_end", "provider")
    )

    if motorcycle_id:
        fees_qs = fees_qs.filter(motorcycle_id=motorcycle_id)
        policies_qs = policies_qs.filter(motorcycle_id=motorcycle_id)

    if q:
        fees_qs = fees_qs.filter(Q(notes__icontains=q))
        policies_qs = policies_qs.filter(
            Q(provider__icontains=q) | Q(policy_number__icontains=q) | Q(notes__icontains=q)
        )

    fees_paged = paginate(request, fees_qs, per_page=per_page, page_param="fees_page")
    policies_paged = paginate(request, policies_qs, per_page=per_page, page_param="policies_page")

    context = {
        "fees": list(fees_paged.items),
        "fees_page_obj": fees_paged.page,
        "policies": list(policies_paged.items),
        "policies_page_obj": policies_paged.page,
        "filters": {"q": q, "motorcycle": motorcycle_id},
        "density": density,
    }
    return render(request, "expenses/list.html", context)


@login_required
@pro_required("Exportacao CSV de taxas e seguros")
def expenses_export_view(request):
    return build_export(user=request.user)


@login_required
def annual_fee_create_view(request):
    if request.method == "POST":
        form = AnnualFeeForm(request.POST, user=request.user)
        if form.is_valid():
            fee = form.save()
            sync_fee_reminder(fee)
            messages.success(request, f"Taxa {fee.get_fee_type_display()} {fee.year} criada com sucesso.")
            return redirect("expenses:list")
    else:
        form = AnnualFeeForm(user=request.user)
    configure_form_accessibility(form)

    total_fees = AnnualFee.objects.filter(motorcycle__owner=request.user).count()
    return render(
        request,
        "expenses/fee_form.html",
        {"form": form, "title": "Nova taxa anual", "submit_label": "Salvar taxa", "total_fees": total_fees},
    )


@login_required
def annual_fee_update_view(request, pk: int):
    fee = get_object_or_404(AnnualFee, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method == "POST":
        form = AnnualFeeForm(request.POST, instance=fee, user=request.user)
        if form.is_valid():
            fee = form.save()
            sync_fee_reminder(fee)
            messages.success(request, f"Taxa {fee.get_fee_type_display()} {fee.year} atualizada com sucesso.")
            return redirect("expenses:list")
    else:
        form = AnnualFeeForm(instance=fee, user=request.user)
    configure_form_accessibility(form)

    total_fees = AnnualFee.objects.filter(motorcycle__owner=request.user).count()
    return render(
        request,
        "expenses/fee_form.html",
        {
            "form": form,
            "title": f"Editar {fee.get_fee_type_display()} {fee.year}",
            "submit_label": "Salvar alterações",
            "fee": fee,
            "total_fees": total_fees,
        },
    )


@login_required
def annual_fee_delete_view(request, pk: int):
    fee = get_object_or_404(AnnualFee, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method == "POST":
        label = f"{fee.get_fee_type_display()} {fee.year}"
        delete_fee_reminder(fee)
        fee.delete()
        messages.success(request, f"Taxa {label} removida com sucesso.")
        return redirect("expenses:list")
    return render(request, "expenses/confirm_delete.html", {"object": fee, "object_type": "taxa anual"})


@login_required
def policy_create_view(request):
    if request.method == "POST":
        form = InsurancePolicyForm(request.POST, user=request.user)
        if form.is_valid():
            policy = form.save()
            sync_policy_reminder(policy)
            messages.success(request, f"Seguro {policy.provider} criado com sucesso.")
            return redirect("expenses:list")
    else:
        form = InsurancePolicyForm(user=request.user)
    configure_form_accessibility(form)

    total_policies = InsurancePolicy.objects.filter(motorcycle__owner=request.user).count()
    return render(
        request,
        "expenses/policy_form.html",
        {"form": form, "title": "Novo seguro", "submit_label": "Salvar seguro", "total_policies": total_policies},
    )


@login_required
def policy_update_view(request, pk: int):
    policy = get_object_or_404(InsurancePolicy, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    claims = list(policy.claims.all().order_by("-claim_date", "-created_at"))
    if request.method == "POST":
        form = InsurancePolicyForm(request.POST, instance=policy, user=request.user)
        if form.is_valid():
            policy = form.save()
            sync_policy_reminder(policy)
            messages.success(request, f"Seguro {policy.provider} atualizado com sucesso.")
            return redirect("expenses:list")
    else:
        form = InsurancePolicyForm(instance=policy, user=request.user)
    configure_form_accessibility(form)

    total_policies = InsurancePolicy.objects.filter(motorcycle__owner=request.user).count()
    return render(
        request,
        "expenses/policy_form.html",
        {
            "form": form,
            "title": f"Editar seguro {policy.provider}",
            "submit_label": "Salvar alterações",
            "policy": policy,
            "claims": claims,
            "total_policies": total_policies,
        },
    )


@login_required
def policy_delete_view(request, pk: int):
    policy = get_object_or_404(InsurancePolicy, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method == "POST":
        provider = policy.provider
        delete_policy_reminder(policy)
        policy.delete()
        messages.success(request, f"Seguro {provider} removido com sucesso.")
        return redirect("expenses:list")
    return render(request, "expenses/confirm_delete.html", {"object": policy, "object_type": "seguro"})


@login_required
def claim_create_view(request, policy_pk: int):
    policy = get_object_or_404(InsurancePolicy, pk=policy_pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method == "POST":
        form = InsuranceClaimForm(request.POST)
        if form.is_valid():
            claim = form.save(commit=False)
            claim.policy = policy
            claim.save()
            messages.success(request, "Sinistro registrado com sucesso.")
            return redirect("expenses:policy_update", pk=policy.pk)
    else:
        form = InsuranceClaimForm()
    configure_form_accessibility(form)

    total_claims = InsuranceClaim.objects.filter(policy__motorcycle__owner=request.user).count()
    return render(
        request,
        "expenses/claim_form.html",
        {
            "form": form,
            "title": f"Novo sinistro — {policy.provider}",
            "submit_label": "Salvar sinistro",
            "policy": policy,
            "total_claims": total_claims,
        },
    )


@login_required
def claim_update_view(request, pk: int):
    claim = get_object_or_404(
        InsuranceClaim, pk=pk, policy__motorcycle__owner=request.user, policy__motorcycle__is_active=True
    )
    if request.method == "POST":
        form = InsuranceClaimForm(request.POST, instance=claim)
        if form.is_valid():
            form.save()
            messages.success(request, "Sinistro atualizado com sucesso.")
            return redirect("expenses:policy_update", pk=claim.policy.pk)
    else:
        form = InsuranceClaimForm(instance=claim)
    configure_form_accessibility(form)

    total_claims = InsuranceClaim.objects.filter(policy__motorcycle__owner=request.user).count()
    return render(
        request,
        "expenses/claim_form.html",
        {
            "form": form,
            "title": f"Editar sinistro — {claim.policy.provider}",
            "submit_label": "Salvar alterações",
            "claim": claim,
            "total_claims": total_claims,
        },
    )


@login_required
def claim_delete_view(request, pk: int):
    claim = get_object_or_404(
        InsuranceClaim, pk=pk, policy__motorcycle__owner=request.user, policy__motorcycle__is_active=True
    )
    if request.method == "POST":
        policy_pk = claim.policy.pk
        claim.delete()
        messages.success(request, "Sinistro removido com sucesso.")
        return redirect("expenses:policy_update", pk=policy_pk)
    return render(request, "expenses/confirm_delete.html", {"object": claim, "object_type": "sinistro"})
