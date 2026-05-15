from __future__ import annotations

from rest_framework import serializers


class FuelRecordSerializer(serializers.Serializer):
    def to_representation(self, record):
        return {
            "id": record.pk,
            "motorcycle": record.motorcycle.name,
            "date": record.date.isoformat(),
            "odometer_km": record.odometer_km,
            "liters": str(record.liters),
            "total_price": str(record.total_price),
            "fuel_type": record.fuel_type,
            "station_name": record.station_name or (record.station.name if record.station else ""),
        }


class MaintenanceRecordSerializer(serializers.Serializer):
    def to_representation(self, record):
        return {
            "id": record.pk,
            "motorcycle": record.motorcycle.name,
            "date": record.date.isoformat(),
            "odometer_km": record.odometer_km,
            "maintenance_type": record.maintenance_type,
            "cost": str(record.cost),
        }


class TireRecordSerializer(serializers.Serializer):
    def to_representation(self, record):
        return {
            "id": record.pk,
            "motorcycle": record.motorcycle.name,
            "installed_at": record.installed_at.isoformat(),
            "position": record.position,
            "brand_model": record.brand_model,
            "cost": str(record.cost),
        }


class ReminderSerializer(serializers.Serializer):
    def to_representation(self, reminder):
        return {
            "id": reminder.pk,
            "motorcycle": reminder.motorcycle.name,
            "title": reminder.title,
            "is_active": reminder.is_active,
        }


class MotorcycleDocumentSerializer(serializers.Serializer):
    def to_representation(self, document):
        return {
            "id": document.pk,
            "motorcycle": document.motorcycle.name,
            "name": document.name,
            "document_type": document.document_type,
        }


class ExpenseSerializer(serializers.Serializer):
    def to_representation(self, expense):
        if expense["kind"] == "fee":
            fee = expense["object"]
            return {
                "id": f"fee-{fee.pk}",
                "motorcycle": fee.motorcycle.name,
                "kind": "annual_fee",
                "title": fee.get_fee_type_display(),
                "amount": str(fee.amount),
            }

        policy = expense["object"]
        return {
            "id": f"policy-{policy.pk}",
            "motorcycle": policy.motorcycle.name,
            "kind": "insurance",
            "title": policy.provider,
            "amount": str(policy.premium),
        }
