from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.inventory.models import InventoryItem


class InventoryItemModelTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="inv-user", email="inv@example.com", password="pass12345")
        self.other = User.objects.create_user(username="inv-other", email="inv-other@example.com", password="pass12345")

    def test_str_shows_name_and_quantity(self):
        item = InventoryItem.objects.create(owner=self.user, name="Corrente", quantity=2)
        self.assertEqual(str(item), "Corrente (Qtd: 2)")

    def test_owner_scoping(self):
        InventoryItem.objects.create(owner=self.user, name="Peca A")
        InventoryItem.objects.create(owner=self.other, name="Peca B")
        self.assertEqual(InventoryItem.objects.filter(owner=self.user).count(), 1)
        self.assertEqual(InventoryItem.objects.filter(owner=self.other).count(), 1)

    def test_default_quantity_zero(self):
        item = InventoryItem.objects.create(owner=self.user, name="Filtro")
        self.assertEqual(item.quantity, 0)


class InventoryAdminTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser(username="inv-admin", email="inv-admin@example.com", password="pass12345")
        self.user = User.objects.create_user(username="inv-owner", email="inv-owner@example.com", password="pass12345")
        self.item = InventoryItem.objects.create(owner=self.user, name="Peca", part_number="123")

    def test_admin_list_accessible(self):
        self.client.force_login(self.admin)
        response = self.client.get(reverse("admin:inventory_inventoryitem_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Peca")

    def test_admin_scoped_to_owner_for_non_superuser(self):
        from django.contrib.auth.models import Permission
        from django.contrib.contenttypes.models import ContentType
        ct = ContentType.objects.get_for_model(InventoryItem)
        perm = Permission.objects.get(codename="view_inventoryitem", content_type=ct)
        self.user.user_permissions.add(perm)
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        InventoryItem.objects.create(owner=self.admin, name="Peca Admin")
        self.client.force_login(self.user)
        response = self.client.get(reverse("admin:inventory_inventoryitem_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Peca")
        self.assertNotContains(response, "Peca Admin")
