from __future__ import annotations

import ipaddress
import socket
from pathlib import Path, PurePosixPath
from posixpath import normpath
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import urlopen

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.documents.models import DocumentType, MotorcycleDocument
from apps.garage.models import Motorcycle, MotorcycleSpec, MotorcycleTemplate
from apps.maintenance.models import MaintenancePart, MaintenancePlanItem

SPEC_CHAR_FIELDS = {
    "fuel_type_recommendation",
    "oil_type_recommendation",
    "oil_viscosity_recommendation",
    "tire_size_front",
    "tire_size_rear",
    "tire_speed_rating",
    "recommended_tire_pressure_front",
    "recommended_tire_pressure_rear",
    "battery_spec",
    "chain_size",
    "manual_reference",
}
SPEC_FIELDS = [
    "fuel_tank_capacity_l",
    "fuel_type_recommendation",
    "fuel_octane_min",
    "oil_capacity_l",
    "oil_type_recommendation",
    "oil_viscosity_recommendation",
    "tire_size_front",
    "tire_size_rear",
    "tire_speed_rating",
    "recommended_tire_pressure_front",
    "recommended_tire_pressure_rear",
    "battery_spec",
    "chain_size",
    "manual_reference",
]


def resolve_template_year(template: MotorcycleTemplate) -> int:
    current_year = timezone.localdate().year
    if template.year_to is None:
        return max(template.year_from, current_year)
    return max(template.year_from, min(current_year, template.year_to))


@transaction.atomic
def recompute_motorcycle_odometer(motorcycle_id: int) -> int:
    try:
        motorcycle = Motorcycle.objects.select_for_update().get(id=motorcycle_id)  # pylint: disable=no-member
    except Motorcycle.DoesNotExist:  # pylint: disable=no-member
        return 0

    fuel_max = motorcycle.fuel_records.aggregate(max_odometer=Max("odometer_km"))["max_odometer"] or 0
    maintenance_max = motorcycle.maintenance_records.aggregate(max_odometer=Max("odometer_km"))["max_odometer"] or 0
    tire_max = motorcycle.tire_records.aggregate(max_odometer=Max("installed_odometer_km"))["max_odometer"] or 0
    record_max = max(int(fuel_max or 0), int(maintenance_max or 0), int(tire_max or 0))

    override = int(motorcycle.odometer_override_km or 0)
    effective = max(record_max, override)

    motorcycle.set_current_odometer(effective)
    return effective


def bump_motorcycle_odometer(motorcycle_id: int, odometer_km: int | None) -> int:
    if odometer_km is None:
        return 0
    try:
        value = int(odometer_km)
    except (TypeError, ValueError):
        return 0
    if value <= 0:
        return 0

    updated = Motorcycle.objects.filter(id=motorcycle_id, current_odometer_km__lt=value).update(
        current_odometer_km=value,
        current_odometer_updated_at=timezone.now(),
    )
    return value if updated else 0


@transaction.atomic
def apply_template_to_motorcycle(
    *,
    motorcycle: Motorcycle,
    owner,
    template: MotorcycleTemplate | None,
    spec_payload: dict,
    manual_prefetch: tuple[bytes, str] | None = None,
) -> list[str]:
    warnings: list[str] = []
    _save_motorcycle_spec(motorcycle=motorcycle, spec_payload=spec_payload)

    if template is None:
        return warnings

    _create_plan_items_from_template(motorcycle=motorcycle, template=template)
    _create_parts_from_template(owner=owner, template=template)

    template_spec = getattr(template, "spec", None)
    if template_spec and template_spec.manual_url:
        try:
            _attach_manual_document(
                motorcycle=motorcycle,
                template=template,
                manual_source=template_spec.manual_url,
                manual_prefetch=manual_prefetch,
            )
        except (OSError, URLError, ValueError) as exc:
            warnings.append(f"Não foi possível anexar o manual automaticamente: {exc}")

    return warnings


def variant_observation_text(variant: str) -> str:
    cleaned_variant = (variant or "").strip()
    if not cleaned_variant:
        return ""
    return f"Variante: {cleaned_variant}"


def _save_motorcycle_spec(*, motorcycle: Motorcycle, spec_payload: dict):
    spec, _ = MotorcycleSpec.objects.get_or_create(motorcycle=motorcycle)
    for field_name in SPEC_FIELDS:
        value = spec_payload.get(field_name)
        if field_name in SPEC_CHAR_FIELDS and value is None:
            value = ""
        setattr(spec, field_name, value)
    spec.save()


def _create_plan_items_from_template(*, motorcycle: Motorcycle, template: MotorcycleTemplate):
    intervals = template.maintenance_intervals.all()
    for interval in intervals:
        plan_item, created = MaintenancePlanItem.objects.get_or_create(
            motorcycle=motorcycle,
            maintenance_type=interval.maintenance_type,
            is_severe_duty_override=interval.is_severe_duty_override,
            defaults={
                "interval_km": interval.interval_km,
                "interval_days": interval.interval_days,
                "last_done_km": None,
                "last_done_date": None,
                "notes": interval.notes,
                "is_active": True,
            },
        )
        if not created:
            plan_item.interval_km = interval.interval_km
            plan_item.interval_days = interval.interval_days
            plan_item.last_done_km = None
            plan_item.last_done_date = None
            plan_item.notes = interval.notes
            plan_item.is_active = True
        plan_item.full_clean()
        plan_item.save()


def _create_parts_from_template(*, owner, template: MotorcycleTemplate):
    for part in template.recommended_parts.all():
        MaintenancePart.objects.get_or_create(
            owner=owner,
            name=part.part_name,
            defaults={
                "manufacturer": part.manufacturer,
                "sku": part.part_number,
                "notes": part.notes,
            },
        )


def _attach_manual_document(
    *, motorcycle: Motorcycle, template: MotorcycleTemplate, manual_source: str, manual_prefetch: tuple[bytes, str] | None = None
):
    if manual_prefetch is not None:
        content, source_filename = manual_prefetch
    else:
        content, source_filename = _read_manual_content(manual_source)
    suffix = Path(source_filename).suffix.lower() or ".pdf"
    doc_name = f"Manual {template.brand} {template.model}".strip()
    if MotorcycleDocument.objects.filter(
        motorcycle=motorcycle,
        document_type=DocumentType.MANUAL,
        name=doc_name,
    ).exists():
        return

    file_name = f"manual-{motorcycle.id}{suffix}"
    document = MotorcycleDocument(
        motorcycle=motorcycle,
        name=doc_name,
        document_type=DocumentType.MANUAL,
    )
    document.file.save(file_name, ContentFile(content), save=False)
    document.save()


def _is_internal_ip(hostname: str) -> bool:
    """Return True if hostname resolves to a private/loopback/reserved IP."""
    try:
        addrinfo = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        # If we cannot resolve, conservatively block.
        return True
    for _family, _socktype, _proto, _canonname, sockaddr in addrinfo:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_multicast or ip.is_link_local:
            return True
    return False


def _read_manual_content(source: str) -> tuple[bytes, str]:
    source = (source or "").strip()
    if not source:
        raise ValueError("fonte de manual vazia")

    parsed = urlparse(source)

    if parsed.scheme in {"http", "https"}:
        # SSRF guard: block private/loopback/reserved IPs before fetching.
        if not parsed.netloc or _is_internal_ip(parsed.hostname or parsed.netloc):
            raise ValueError("URL do manual aponta para um destino interno ou inválido")
        with urlopen(source, timeout=15) as response:  # nosec B310
            payload = response.read()
            final_url = getattr(response, "url", source)
        # Re-check final URL in case of redirect to internal host.
        final_parsed = urlparse(final_url)
        if _is_internal_ip(final_parsed.hostname or final_parsed.netloc):
            raise ValueError("Redirecionamento do manual aponta para destino interno")
        filename = Path(urlparse(final_url).path).name or "manual.pdf"
        if not payload:
            raise ValueError("arquivo remoto vazio")
        return payload, filename

    if parsed.scheme:
        raise ValueError("fonte de manual deve ser http(s) ou caminho interno relativo")

    normalized = normpath(source.replace("\\", "/")).lstrip("/")
    source_path = Path(source)
    posix_path = PurePosixPath(source.replace("\\", "/"))
    if source_path.is_absolute() or posix_path.is_absolute() or ".." in posix_path.parts or normalized in {"", "."}:
        raise ValueError("caminho interno de manual invalido")

    if default_storage.exists(normalized):
        with default_storage.open(normalized, "rb") as fp:
            payload = fp.read()
        filename = Path(normalized).name or "manual.pdf"
        if not payload:
            raise ValueError("arquivo interno vazio")
        return payload, filename

    raise OSError(f"fonte de manual nao encontrada: {source}")
