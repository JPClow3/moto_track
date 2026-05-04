from datetime import date

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from apps.documents.models import DocumentType, MotorcycleDocument
from apps.garage.models import Motorcycle
from apps.reminders.models import Reminder


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

    def test_create_reminder_for_document_valid_until(self):
        self.client.force_login(self.user)
        document = MotorcycleDocument.objects.filter(motorcycle=self.motorcycle).first()
        document.valid_until = date(2026, 5, 1)
        document.notify_before_days = 30
        document.save()

        response = self.client.post(reverse("documents:create_reminder", args=[document.pk]))
        self.assertEqual(response.status_code, 302)
        reminder = Reminder.objects.get(motorcycle=self.motorcycle, title__icontains=document.name)
        self.assertEqual(reminder.reference_date, date(2026, 4, 1))
        self.assertEqual(reminder.trigger_value_days, 30)

    def test_invalid_upload_marks_form_for_focus(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("documents:list"), {})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context["upload_has_errors"])
        self.assertContains(response, 'id="documents-upload-form"')
        self.assertContains(response, 'data-upload-has-errors="true"')

    def test_upload_form_is_marked_for_offline_queue(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("documents:list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-offline-queue="documents:list"')
        self.assertContains(response, 'name="client_submission_id"')

    def test_upload_replay_with_same_client_submission_is_idempotent(self):
        ClientSubmission = self.motorcycle._meta.apps.get_model("core", "ClientSubmission")
        token = "documents-replay-token"

        self.client.force_login(self.user)
        for _ in range(2):
            response = self.client.post(
                reverse("documents:list"),
                {
                    "motorcycle": self.motorcycle.pk,
                    "name": "Cupom offline",
                    "document_type": DocumentType.RECEIPT,
                    "file": SimpleUploadedFile("cupom.pdf", b"pdf", content_type="application/pdf"),
                    "notify_before_days": 30,
                    "client_submission_id": token,
                },
            )
            self.assertEqual(response.status_code, 302)

        self.assertEqual(MotorcycleDocument.objects.filter(motorcycle=self.motorcycle, name="Cupom offline").count(), 1)
        document = MotorcycleDocument.objects.get(motorcycle=self.motorcycle, name="Cupom offline")
        submission = ClientSubmission.objects.get(owner=self.user, token=token)
        self.assertEqual(submission.action, "documents:list")
        self.assertEqual(submission.result_model, "documents.MotorcycleDocument")
        self.assertEqual(submission.result_pk, document.pk)

    def test_upload_replay_with_claimed_client_submission_skips_duplicate_side_effect(self):
        ClientSubmission = self.motorcycle._meta.apps.get_model("core", "ClientSubmission")
        token = "documents-claimed-token"
        ClientSubmission.objects.create(owner=self.user, token=token, action="documents:list")

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("documents:list"),
            {
                "motorcycle": self.motorcycle.pk,
                "name": "Cupom offline concorrente",
                "document_type": DocumentType.RECEIPT,
                "file": SimpleUploadedFile("cupom.pdf", b"pdf", content_type="application/pdf"),
                "notify_before_days": 30,
                "client_submission_id": token,
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertFalse(
            MotorcycleDocument.objects.filter(
                motorcycle=self.motorcycle,
                name="Cupom offline concorrente",
            ).exists()
        )
