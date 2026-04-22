from __future__ import annotations

from pathlib import Path
from urllib.error import URLError
from urllib.parse import unquote, urlparse
from urllib.request import urlopen

from django.conf import settings
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
        MaintenancePlanItem.objects.update_or_create(
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


def _attach_manual_document(*, motorcycle: Motorcycle, template: MotorcycleTemplate, manual_source: str):
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


def _read_manual_content(source: str) -> tuple[bytes, str]:
    source = (source or "").strip()
    if not source:
        raise ValueError("fonte de manual vazia")

    parsed = urlparse(source)

    if parsed.scheme in {"http", "https"}:
        with urlopen(source, timeout=25) as response:  # nosec B310
            payload = response.read()
            final_url = getattr(response, "url", source)
        filename = Path(urlparse(final_url).path).name or "manual.pdf"
        if not payload:
            raise ValueError("arquivo remoto vazio")
        return payload, filename

    if parsed.scheme == "file":
        file_path_str = unquote(parsed.path)
        if file_path_str.startswith("/") and len(file_path_str) > 2 and file_path_str[2] == ":":
            file_path_str = file_path_str[1:]
        file_path = Path(file_path_str)
        if not file_path.exists() or not file_path.is_file():
            raise OSError(f"arquivo interno nao encontrado: {file_path}")
        return file_path.read_bytes(), file_path.name

    local_candidate = Path(source)
    if local_candidate.is_file():
        return local_candidate.read_bytes(), local_candidate.name

    media_candidate = Path(settings.MEDIA_ROOT) / source
    if media_candidate.is_file():
        return media_candidate.read_bytes(), media_candidate.name

    base_candidate = Path(settings.BASE_DIR) / source
    if base_candidate.is_file():
        return base_candidate.read_bytes(), base_candidate.name

    if default_storage.exists(source):
        with default_storage.open(source, "rb") as fp:
            payload = fp.read()
        filename = Path(source).name or "manual.pdf"
        if not payload:
            raise ValueError("arquivo interno vazio")
        return payload, filename

    raise OSError(f"fonte de manual nao encontrada: {source}")
