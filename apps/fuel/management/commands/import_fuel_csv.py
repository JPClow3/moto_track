import csv
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils.dateparse import parse_date

from apps.core.validation import validate_odometer_sequence
from apps.fuel.models import FuelRecord, FuelType
from apps.garage.models import Motorcycle


User = get_user_model()


class Command(BaseCommand):
    help = "Importa abastecimentos de um CSV (date,odometer_km,liters,total_price,station_name)."

    def add_arguments(self, parser):
        parser.add_argument("--file", required=True, help="Caminho para o arquivo CSV")
        parser.add_argument("--user", required=True, help="Email ou username do proprietário")
        parser.add_argument("--motorcycle", required=True, type=int, help="ID da moto")
        parser.add_argument("--dry-run", action="store_true", help="Valida sem importar")

    def handle(self, *args, **options):
        file_path = options["file"]
        user_lookup = options["user"]
        motorcycle_id = options["motorcycle"]
        dry_run = options["dry_run"]

        user = User.objects.filter(email=user_lookup).first() or User.objects.filter(username=user_lookup).first()
        if not user:
            raise CommandError(f"Usuário não encontrado: {user_lookup}")

        motorcycle = Motorcycle.objects.filter(id=motorcycle_id, owner=user).first()
        if not motorcycle:
            raise CommandError(f"Moto {motorcycle_id} não encontrada para o usuário.")

        created_count = 0
        error_count = 0

        with open(file_path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        if dry_run:
            self.stdout.write(self.style.WARNING("MODO PREVIEW - nenhum registro será criado."))

        for index, raw in enumerate(rows, start=1):
            errors = []
            parsed_date = parse_date((raw.get("date") or "").strip())
            if parsed_date is None:
                errors.append("Data inválida.")

            try:
                odometer_km = int((raw.get("odometer_km") or "").strip())
            except ValueError:
                errors.append("Odômetro inválido.")
                odometer_km = 0

            try:
                liters = Decimal(str(raw.get("liters") or "").strip())
            except Exception:
                errors.append("Litros inválido.")
                liters = Decimal("0")

            try:
                total_price = Decimal(str(raw.get("total_price") or "").strip())
            except Exception:
                errors.append("Valor total inválido.")
                total_price = Decimal("0")

            station_name = (raw.get("station_name") or "").strip()

            price_per_liter = Decimal("0")
            if liters > 0 and total_price > 0:
                price_per_liter = total_price / liters

            fuel_type = FuelType.GASOLINE

            if parsed_date and odometer_km:
                if FuelRecord.objects.filter(motorcycle=motorcycle, date=parsed_date, odometer_km=odometer_km).exists():
                    errors.append("Registro duplicado.")

            if errors:
                self.stdout.write(f"Linha {index}: {', '.join(errors)}")
                error_count += 1
                continue

            if not dry_run:
                record = FuelRecord(
                    motorcycle=motorcycle,
                    date=parsed_date,
                    odometer_km=odometer_km,
                    liters=liters,
                    total_price=total_price,
                    price_per_liter=price_per_liter,
                    fuel_type=fuel_type,
                    tank_full=True,
                    station_name=station_name,
                )
                record.full_clean()
                seq_errors = validate_odometer_sequence(
                    motorcycle=motorcycle,
                    event_date=parsed_date,
                    odometer_km=odometer_km,
                )
                if seq_errors:
                    self.stdout.write(f"Linha {index}: {', '.join(seq_errors.values())}")
                    error_count += 1
                    continue
                record.save()
                created_count += 1

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"Preview concluído: {len(rows)} linhas, {error_count} erros."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Importados {created_count} registros. {error_count} erros."))
