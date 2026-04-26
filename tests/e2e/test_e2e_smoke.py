import pytest
from playwright.sync_api import Page, expect

pytestmark = pytest.mark.e2e

BASE_URL = "http://localhost:8000"


def test_landing_page_loads(page: Page):
    page.goto(f"{BASE_URL}/")
    expect(page).to_have_title("Moto Track")


def test_login_page_has_form(page: Page):
    page.goto(f"{BASE_URL}/accounts/login/")
    expect(page.locator("input[name='login']")).to_be_visible()
    expect(page.locator("input[type='password']")).to_be_visible()


def test_dashboard_redirects_anonymous_to_login(page: Page):
    page.goto(f"{BASE_URL}/dashboard/")
    expect(page).to_have_url(lambda url: "/accounts/login/" in url)
