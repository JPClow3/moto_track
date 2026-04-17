from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.documents.models import DocumentType, MotorcycleDocument
from apps.fuel.models import FuelGrade, FuelRecord, FuelStation, FuelType
from apps.garage.models import Motorcycle, MotorcycleSpec
from apps.maintenance.models import MaintenancePart, MaintenancePartType, MaintenanceRecord, MaintenanceType
from apps.reminders.models import Reminder, TriggerType
from apps.tires.models import TirePosition, TireProduct, TireRecord, TireType


class Command(BaseCommand):
	help = "Create a small set of demo data for the app."

	def add_arguments(self, parser):
		parser.add_argument(
			"--email",
			default="demo@mototrack.local",
			help="Email for the demo user.",
		)
		parser.add_argument(
			"--password",
			default="demo12345",
			help="Password for the demo user.",
		)

	@transaction.atomic
	def handle(self, *args, **options):
		user_model = get_user_model()
		user, created = user_model.objects.get_or_create(
			email=options["email"],
			defaults={"username": options["email"], "is_active": True},
		)
		if created:
			user.set_password(options["password"])
			user.save(update_fields=["password"])
		else:
			if not user.username:
				user.username = options["email"]
				user.save(update_fields=["username"])

		motorcycle, _ = Motorcycle.objects.get_or_create(
			owner=user,
			name="Urban 200",
			defaults={
				"brand": "Honda",
				"model": "CB 300F",
				"year": 2024,
				"license_plate": "DEM-2026",
			},
		)
		MotorcycleSpec.objects.get_or_create(
			motorcycle=motorcycle,
			defaults={
				"fuel_tank_capacity_l": Decimal("14.50"),
				"fuel_type_recommendation": "Gasolina premium",
				"fuel_octane_min": 95,
				"oil_capacity_l": Decimal("1.80"),
				"tire_size_front": "110/70R17",
				"tire_size_rear": "150/60R17",
				"tire_speed_rating": "H",
				"battery_spec": "12V 7Ah",
				"chain_size": "520",
				"recommended_tire_pressure_front": "29 psi",
				"recommended_tire_pressure_rear": "33 psi",
				"oil_type_recommendation": "Semi-sintético",
				"oil_viscosity_recommendation": "10W-40",
				"manual_reference": "Manual 2026",
			},
		)

		station, _ = FuelStation.objects.get_or_create(
			owner=user,
			name="Posto Central",
			defaults={"brand": "Shell", "city": "São Paulo", "state": "SP"},
		)
		grade, _ = FuelGrade.objects.get_or_create(
			owner=user,
			name="Gasolina aditivada",
			defaults={
				"fuel_type": FuelType.PREMIUM_GASOLINE,
				"octane_rating": 95,
				"default_price_per_liter": Decimal("6.890"),
			},
		)
		FuelRecord.objects.update_or_create(
			motorcycle=motorcycle,
			date=timezone.localdate(),
			odometer_km=12500,
			defaults={
				"station": station,
				"fuel_grade": grade,
				"liters": Decimal("12.500"),
				"total_price": Decimal("86.12"),
				"price_per_liter": Decimal("6.890"),
				"fuel_type": FuelType.PREMIUM_GASOLINE,
				"tank_full": True,
				"station_name": "Posto Central",
			},
		)

		part, _ = MaintenancePart.objects.get_or_create(
			owner=user,
			name="Filtro de óleo OEM",
			defaults={"manufacturer": "Honda", "part_type": MaintenancePartType.FILTER, "price": Decimal("45.00")},
		)
		record, _ = MaintenanceRecord.objects.get_or_create(
			motorcycle=motorcycle,
			date=timezone.localdate(),
			odometer_km=12300,
			defaults={
				"maintenance_type": MaintenanceType.OIL_CHANGE,
				"description": "Troca preventiva de óleo e filtro.",
				"parts_used": "Óleo 10W-40; filtro OEM",
				"cost": Decimal("180.00"),
				"workshop": "Oficina Central",
				"interval_km": 5000,
				"interval_days": 180,
			},
		)
		record.parts.add(part)

		tire_product, _ = TireProduct.objects.get_or_create(
			owner=user,
			manufacturer="Pirelli",
			model_name="Angel GT",
			defaults={
				"tire_type": TireType.TOURING,
				"width_mm": 150,
				"aspect_ratio": 60,
				"rim_diameter_in": 17,
				"load_index": "66",
				"speed_rating": "H",
				"max_speed_kmh": 210,
				"price": Decimal("790.00"),
			},
		)
		TireRecord.objects.get_or_create(
			motorcycle=motorcycle,
			position=TirePosition.REAR,
			installed_at=timezone.localdate(),
			defaults={
				"tire_product": tire_product,
				"brand_model": "Pirelli Angel GT",
				"installed_odometer_km": 12300,
				"cost": Decimal("790.00"),
				"purchase_price": Decimal("790.00"),
				"recommended_pressure": "33 psi",
				"wear_percent": 5,
				"estimated_change_km": 22000,
			},
		)

		Reminder.objects.get_or_create(
			motorcycle=motorcycle,
			title="Trocar óleo",
			defaults={
				"description": "Próxima troca preventiva de óleo.",
				"trigger_type": TriggerType.BY_KM,
				"trigger_value_km": 5000,
				"reference_km": 12300,
				"is_active": True,
				"send_email": True,
			},
		)

		MotorcycleDocument.objects.get_or_create(
			motorcycle=motorcycle,
			name="Manual da moto",
			defaults={
				"document_type": DocumentType.MANUAL,
				"file": SimpleUploadedFile("manual-demo.txt", b"Moto Track demo manual"),
				"notes": "Documento demo para a moto principal.",
			},
		)

		self.stdout.write(self.style.SUCCESS("Demo data created or already present."))
