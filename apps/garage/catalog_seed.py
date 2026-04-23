from decimal import Decimal

MOTORCYCLE_TEMPLATE_DATA = [
    {
        "brand": "Honda",
        "model": "CG 160 Titan / Fan / Start",
        "year_from": 2016,
        "year_to": 2024,
        "engine_cc": 160,
        "spec": {
            "fuel_tank_capacity_l": Decimal("16.1"),
            "oil_capacity_l": Decimal("1.0"),
            "tire_size_front": "80/100-18",
            "tire_size_rear": "100/80-18",
            "recommended_tire_pressure_front": "25 psi",
            "recommended_tire_pressure_rear": "29 psi (solo) / 33 psi",
            "oil_viscosity_recommendation": "10W-30",
            "oil_type_recommendation": "Mineral / Semi-sintetico",
            "consumption_avg_km_l": Decimal("35.0"),
            "manual_url": "https://www.honda.com.br/pos-venda/motos",
        },
        "intervals": [
            {"type": "oil_change", "km": 6000, "days": 365},
            {"type": "air_filter", "km": 18000},
            {"type": "spark_plug", "km": 12000},
            {"type": "review", "km": 6000, "days": 365},
        ],
    },
    {
        "brand": "Yamaha",
        "model": "Fazer 250 (YS 250)",
        "year_from": 2005,
        "year_to": 2017,
        "engine_cc": 250,
        "spec": {
            "fuel_tank_capacity_l": Decimal("19.2"),
            "oil_capacity_l": Decimal("1.35"),
            "tire_size_front": "100/80-17",
            "tire_size_rear": "130/70-17",
            "recommended_tire_pressure_front": "29 psi",
            "recommended_tire_pressure_rear": "33 psi",
            "oil_viscosity_recommendation": "20W-50",
            "oil_type_recommendation": "Yamalube Mineral",
            "consumption_avg_km_l": Decimal("28.0"),
            "manual_url": "https://www.yamaha-motor.com.br/manuais",
        },
        "intervals": [
            {"type": "oil_change", "km": 5000, "days": 365},
            {"type": "oil_filter", "km": 10000},
            {"type": "air_filter", "km": 15000},
            {"type": "review", "km": 5000, "days": 365},
        ],
    },
    {
        "brand": "Yamaha",
        "model": "FZ25 (Fazer 250)",
        "year_from": 2018,
        "year_to": 2024,
        "engine_cc": 250,
        "spec": {
            "fuel_tank_capacity_l": Decimal("14.2"),
            "oil_capacity_l": Decimal("1.45"),
            "tire_size_front": "100/80-17",
            "tire_size_rear": "140/70-17",
            "recommended_tire_pressure_front": "29 psi",
            "recommended_tire_pressure_rear": "33 psi",
            "oil_viscosity_recommendation": "10W-40 / 20W-50",
            "oil_type_recommendation": "Yamalube Semi-sintetico",
            "consumption_avg_km_l": Decimal("30.0"),
            "manual_url": "https://www.yamaha-motor.com.br/manuais",
        },
        "intervals": [
            {"type": "oil_change", "km": 5000, "days": 365},
            {"type": "oil_filter", "km": 10000},
            {"type": "air_filter", "km": 15000},
            {"type": "review", "km": 5000, "days": 365},
        ],
    },
    {
        "brand": "Honda",
        "model": "CB 300R",
        "year_from": 2009,
        "year_to": 2015,
        "engine_cc": 300,
        "spec": {
            "fuel_tank_capacity_l": Decimal("18.0"),
            "oil_capacity_l": Decimal("1.5"),
            "tire_size_front": "110/70-17",
            "tire_size_rear": "140/70-17",
            "recommended_tire_pressure_front": "29 psi",
            "recommended_tire_pressure_rear": "33 psi",
            "oil_viscosity_recommendation": "10W-30",
            "oil_type_recommendation": "Mineral / Semi-sintetico",
            "consumption_avg_km_l": Decimal("24.0"),
            "manual_url": "https://www.honda.com.br/pos-venda/motos",
        },
        "intervals": [
            {"type": "oil_change", "km": 6000, "days": 365},
            {"type": "air_filter", "km": 18000},
            {"type": "spark_plug", "km": 12000},
            {"type": "review", "km": 6000, "days": 365},
        ],
    },
    {
        "brand": "Honda",
        "model": "CB 300F Twister",
        "year_from": 2023,
        "year_to": 2024,
        "engine_cc": 300,
        "spec": {
            "fuel_tank_capacity_l": Decimal("14.1"),
            "oil_capacity_l": Decimal("1.5"),
            "tire_size_front": "110/70-17",
            "tire_size_rear": "150/60-17",
            "recommended_tire_pressure_front": "29 psi",
            "recommended_tire_pressure_rear": "33 psi",
            "oil_viscosity_recommendation": "10W-30",
            "oil_type_recommendation": "Semi-sintetico",
            "consumption_avg_km_l": Decimal("25.0"),
            "manual_url": "https://www.honda.com.br/pos-venda/motos",
        },
        "intervals": [
            {"type": "oil_change", "km": 6000, "days": 365},
            {"type": "air_filter", "km": 18000},
            {"type": "spark_plug", "km": 12000},
            {"type": "review", "km": 6000, "days": 365},
        ],
    },
    {
        "brand": "Yamaha",
        "model": "XTZ 250 Lander",
        "year_from": 2019,
        "year_to": 2024,
        "engine_cc": 250,
        "spec": {
            "fuel_tank_capacity_l": Decimal("11.0"),
            "oil_capacity_l": Decimal("1.45"),
            "tire_size_front": "90/90-21",
            "tire_size_rear": "120/80-18",
            "recommended_tire_pressure_front": "22 psi",
            "recommended_tire_pressure_rear": "25 psi (solo) / 33 psi",
            "oil_viscosity_recommendation": "10W-40 / 20W-50",
            "oil_type_recommendation": "Yamalube Semi-sintetico",
            "consumption_avg_km_l": Decimal("28.0"),
            "manual_url": "https://www.yamaha-motor.com.br/manuais",
        },
        "intervals": [
            {"type": "oil_change", "km": 5000, "days": 365},
            {"type": "oil_filter", "km": 10000},
            {"type": "review", "km": 5000, "days": 365},
        ],
    },
    {
        "brand": "KTM",
        "model": "200 Duke",
        "year_from": 2014,
        "year_to": 2024,
        "engine_cc": 200,
        "spec": {
            "fuel_tank_capacity_l": Decimal("11.0"),
            "oil_capacity_l": Decimal("1.5"),
            "tire_size_front": "110/70-17",
            "tire_size_rear": "150/60-17",
            "recommended_tire_pressure_front": "29 psi",
            "recommended_tire_pressure_rear": "32 psi",
            "oil_viscosity_recommendation": "15W-50",
            "oil_type_recommendation": "Sintetico (Motorex)",
            "consumption_avg_km_l": Decimal("28.0"),
            "manual_url": "https://www.ktm.com/en-int/service/manuals.html",
        },
        "intervals": [
            {"type": "oil_change", "km": 7500, "days": 365},
            {"type": "oil_filter", "km": 7500},
            {"type": "air_filter", "km": 15000},
            {"type": "spark_plug", "km": 15000},
            {"type": "review", "km": 7500, "days": 365},
        ],
    },
]


def seed_motorcycle_templates(template_model, spec_model, interval_model) -> int:
    count = 0
    for data in MOTORCYCLE_TEMPLATE_DATA:
        template, _ = template_model.objects.update_or_create(
            brand=data["brand"],
            model=data["model"],
            year_from=data["year_from"],
            year_to=data["year_to"],
            variant=data.get("variant", ""),
            country_code=data.get("country_code", "BR"),
            defaults={"engine_cc": data["engine_cc"]},
        )

        spec_model.objects.update_or_create(
            template=template,
            defaults=data["spec"],
        )

        for interval in data["intervals"]:
            interval_model.objects.update_or_create(
                template=template,
                maintenance_type=interval["type"],
                is_severe_duty_override=interval.get("is_severe_duty_override", False),
                defaults={
                    "interval_km": interval.get("km"),
                    "interval_days": interval.get("days"),
                    "notes": interval.get("notes", ""),
                },
            )
        count += 1
    return count
