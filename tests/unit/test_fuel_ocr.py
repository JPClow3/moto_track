import pytest
from django.urls import reverse
from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile

@pytest.mark.django_db
@patch('apps.fuel.services.ocr.parse_receipt_image')
def test_fuel_ocr_scan_view(mock_parse, client, django_user_model):
    user = django_user_model.objects.create(username="testuser", password="password")
    client.force_login(user)
    mock_parse.return_value = {"liters": 10.0, "total_price": 50.0, "price_per_liter": 5.0}
    url = reverse("fuel:ocr_scan")
    dummy_file = SimpleUploadedFile("receipt.jpg", b"dummy content", content_type="image/jpeg")
    response = client.post(url, {"receipt_file": dummy_file})
    assert response.status_code == 200
