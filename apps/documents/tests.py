from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from apps.documents.models import DocumentType, MotorcycleDocument
from apps.garage.models import Motorcycle


class DocumentsTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="docs-user", email="docs@example.com", password="pass12345")
        self.other_user = User.objects.create_user(
            username="other-user", email="other@example.com", password="pass12345"
        )
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023
        )
        self.other_motorcycle = Motorcycle.objects.create(
            owner=self.other_user, name="Moto B", brand="Yamaha", model="MT", year=2024
        )

        MotorcycleDocument.objects.create(
            motorcycle=self.motorcycle,
            name="Manual A",
            document_type=DocumentType.MANUAL,
            file=SimpleUploadedFile("manual-a.pdf", b"test", content_type="application/pdf"),
        )
        MotorcycleDocument.objects.create(
            motorcycle=self.other_motorcycle,
            name="Manual B",
            document_type=DocumentType.MANUAL,
            file=SimpleUploadedFile("manual-b.pdf", b"test", content_type="application/pdf"),
        )

    def test_documents_list_requires_login(self):
        response = self.client.get(reverse("documents:list"))
        self.assertEqual(response.status_code, 302)

    def test_documents_list_is_owner_scoped(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("documents:list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Manual A")
        self.assertNotContains(response, "Manual B")

    def test_document_has_audit_timestamps(self):
        document = MotorcycleDocument.objects.filter(motorcycle=self.motorcycle).first()

        self.assertIsNotNone(document.created_at)
        self.assertIsNotNone(document.updated_at)

    def test_delete_document_removes_owned_document(self):
        self.client.force_login(self.user)
        document = MotorcycleDocument.objects.filter(motorcycle=self.motorcycle).first()
        response = self.client.post(reverse("documents:delete", args=[document.pk]))

        self.assertEqual(response.status_code, 302)
        self.assertFalse(MotorcycleDocument.objects.filter(pk=document.pk).exists())
