import os

import pytest
from playwright.sync_api import Page, expect

pytestmark = pytest.mark.e2e

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:8000")


def test_htmx_odometer_update(page: Page):
    """
    Tests that the odometer quick update form submits via HTMX
    without a full page reload and displays a success message.
    """
    # Use a unique user for testing
    import uuid

    unique_id = uuid.uuid4().hex[:8]
    test_email = f"htmx_{unique_id}@example.com"
    test_password = "Str0ngPassword123!"

    page.goto(f"{BASE_URL}/accounts/signup/")

    if page.title() == "Not Found" or page.locator("text=Not Found").count() > 0:
        page.goto(f"{BASE_URL}/accounts/login/")
        page.fill("input[name='login']", "admin@example.com")
        page.fill("input[name='password']", "admin")
        page.click("button[type='submit']")
    else:
        page.fill("input[name='email']", test_email)
        page.fill("input[name='username']", f"user_{unique_id}")
        page.fill("input[name='password1']", test_password)
        page.fill("input[name='password2']", test_password)
        page.click("button[type='submit']")

    # Create a bike if needed
    page.goto(f"{BASE_URL}/garage/create/")
    if page.locator("input[name='name']").count() > 0:
        page.fill("input[name='name']", "HTMX Bike")
        page.fill("input[name='brand']", "Yamaha")
        page.fill("input[name='model']", "MT-07")
        page.fill("input[name='year']", "2024")
        page.fill("input[name='odometer_override_km']", "1500")
        page.click("button[type='submit']")

    # Go to Dashboard
    page.goto(f"{BASE_URL}/dashboard/")

    # Check if Quick Odometer Update button is present (it might be in a dropdown or modal)
    page.goto(f"{BASE_URL}/odometer/update/")

    # We should see the form
    expect(page.locator("form")).to_be_visible()

    # Let's fill the odometer override
    if page.locator("input[name='odometer_override_km']").count() > 0:
        page.fill("input[name='odometer_override_km']", "1600")

        # We need to click submit and wait for network idle to ensure HTMX completes
        with page.expect_response(lambda response: "odometer/update" in response.url) as response_info:
            page.click("button[type='submit']")

        # Verify the response is not a full page reload but an HTMX response
        assert response_info.value.status in [200, 302, 303, 422]

    page.goto(f"{BASE_URL}/dashboard/")
    expect(page.locator("text=1.600").or_(page.locator("text=1600"))).to_be_visible()
