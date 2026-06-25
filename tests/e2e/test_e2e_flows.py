import os
import re
import pytest
from playwright.sync_api import Page, expect

pytestmark = pytest.mark.e2e

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:8000")


def test_full_user_journey(page: Page):
    """
    Tests the complete user journey:
    1. Sign up (or login if user exists)
    2. Add a motorcycle
    3. Add a fuel record
    4. Add a maintenance record
    5. Check the dashboard
    """
    # 1. Sign Up (Allauth default route is usually /accounts/signup/)
    # We use a unique email to avoid conflicts with existing users in the test DB
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    test_email = f"testuser_{unique_id}@example.com"
    test_password = "Str0ngPassword123!"

    response = page.goto(f"{BASE_URL}/accounts/signup/")
    
    # If the signup page doesn't exist or is disabled, fallback to login
    if page.title() == "Not Found" or (response and response.status == 404):
        page.goto(f"{BASE_URL}/accounts/login/")
        page.fill("input[name='login']", "admin@example.com")
        page.fill("input[name='password']", "admin")
        page.click("button[type='submit']")
    else:
        page.fill("input[name='email']", test_email)
        # Allauth requires a username by default if not disabled
        page.fill("input[name='username']", f"user_{unique_id}")
        # Allauth default password fields
        page.fill("input[name='password1']", test_password)
        page.fill("input[name='password2']", test_password)
        page.click("button[type='submit']")

    # Expect to be redirected to dashboard or at least logged in
    expect(page).not_to_have_url(re.compile(r"/accounts/(signup|login)/"))

    # 2. Add a Motorcycle
    page.goto(f"{BASE_URL}/garage/create/")
    page.fill("input[name='name']", "Test Bike")
    page.fill("input[name='brand']", "Honda")
    page.fill("input[name='model']", "CB500")
    page.fill("input[name='year']", "2023")
    page.fill("input[name='odometer_override_km']", "1000")
    page.click("button[type='submit']")

    # Expect to be back on the dashboard or garage
    expect(page.locator("text=Test Bike")).to_be_visible(timeout=10000)

    # 3. Add a Fuel Record
    page.goto(f"{BASE_URL}/fuel/quick-create/")
    # If there are multiple bikes, select it. If only one, it's hidden or auto-selected.
    # Fill required fields based on forms.py
    page.fill("input[name='date']", "2023-10-01")
    page.fill("input[name='odometer_km']", "1100")
    page.fill("input[name='liters']", "15.5")
    # For total_price, it might use a money widget (total_price_0)
    if page.locator("input[name='total_price_0']").count() > 0:
        page.fill("input[name='total_price_0']", "75.00")
    else:
        page.fill("input[name='total_price']", "75.00")
    page.click("button[type='submit']")

    # Verify fuel record is added (should redirect to list or dashboard)
    expect(page).not_to_have_url(f"{BASE_URL}/fuel/quick-create/")

    # 4. Add a Maintenance Record
    page.goto(f"{BASE_URL}/maintenance/quick-create/")
    # Fill required fields
    # maintenance_type is a choice field, select first valid option if available
    if page.locator("select[name='maintenance_type']").count() > 0:
        page.select_option("select[name='maintenance_type']", index=1)
    
    page.fill("input[name='date']", "2023-10-05")
    page.fill("input[name='odometer_km']", "1200")
    
    if page.locator("input[name='cost_0']").count() > 0:
        page.fill("input[name='cost_0']", "150.00")
    elif page.locator("input[name='cost']").count() > 0:
        page.fill("input[name='cost']", "150.00")
        
    page.fill("textarea[name='description']", "Test oil change")
    page.click("button[type='submit']")

    # Verify maintenance record is added
    expect(page).not_to_have_url(f"{BASE_URL}/maintenance/quick-create/")

    # 5. Check the Dashboard for elements
    page.goto(f"{BASE_URL}/dashboard/")
    expect(page.locator("text=Test Bike")).to_be_visible()
    # It should show the fuel or maintenance we just added in recent activity
    
    # 6. Edge Case: Empty Form Submission (Fuel)
    page.goto(f"{BASE_URL}/fuel/quick-create/")
    page.click("button[type='submit']")
    # Should stay on page and show validation errors
    expect(page).to_have_url(f"{BASE_URL}/fuel/quick-create/")
    
    # Logout
    page.goto(f"{BASE_URL}/accounts/logout/")
    if page.locator("button[type='submit']").count() > 0:
        page.click("button[type='submit']")
    
    expect(page.locator("text=Log In").or_(page.locator("text=Entrar"))).to_be_visible()
