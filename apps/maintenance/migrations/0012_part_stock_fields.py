from django.db import migrations, models


def migrate_inventory_to_parts(apps, schema_editor):
    InventoryItem = apps.get_model("inventory", "InventoryItem")
    MaintenancePart = apps.get_model("maintenance", "MaintenancePart")

    for item in InventoryItem.objects.all().order_by("owner_id", "name", "pk").iterator():
        name = (item.name or "").strip()
        if not name:
            continue

        part = MaintenancePart.objects.filter(owner_id=item.owner_id, name=name).first()
        if part is None:
            part = MaintenancePart(owner_id=item.owner_id, name=name)

        if item.part_number and not part.sku:
            part.sku = item.part_number[:80]
        if item.description:
            description = item.description.strip()
            if description and description not in (part.notes or ""):
                separator = "\n\n" if part.notes else ""
                part.notes = f"{part.notes}{separator}{description}"
        if item.unit_cost is not None and part.price is None:
            part.price = item.unit_cost

        part.stock_quantity = int(part.stock_quantity or 0) + int(item.quantity or 0)
        part.track_stock = True
        part.save()


def reverse_inventory_to_parts(apps, schema_editor):
    # Legacy InventoryItem rows are preserved; no reverse data movement is needed.
    return None


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0003_alter_inventoryitem_owner"),
        ("maintenance", "0011_add_maintenance_photo"),
    ]

    operations = [
        migrations.AddField(
            model_name="maintenancepart",
            name="low_stock_threshold",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="maintenancepart",
            name="stock_quantity",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="maintenancepart",
            name="track_stock",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(migrate_inventory_to_parts, reverse_inventory_to_parts),
    ]
