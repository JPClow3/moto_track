import os
import re

import pytest
from playwright.sync_api import Page, expect

pytestmark = pytest.mark.e2e

BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:8000")


def test_landing_page_loads(page: Page):
    page.goto(f"{BASE_URL}/")
    expect(page).to_have_title(re.compile(r"^Moto Track"))


def test_landing_remains_visible_without_public_polish_js(page: Page):
    page.route("**/static/js/app.js", lambda route: route.abort())

    page.goto(f"{BASE_URL}/")

    expect(page.locator("#hero-title")).to_be_visible()
    assert page.locator(".public-hero").evaluate("el => getComputedStyle(el).opacity") == "1"


def test_landing_mobile_hero_shows_next_section_hint(page: Page):
    page.set_viewport_size({"width": 390, "height": 844})

    page.goto(f"{BASE_URL}/")

    first_section_top = page.locator("#features-title").evaluate("el => el.closest('section').getBoundingClientRect().top")
    assert first_section_top < 844


def test_login_page_has_form(page: Page):
    page.goto(f"{BASE_URL}/accounts/login/")
    expect(page.locator("input[name='login']")).to_be_visible()
    expect(page.locator("input[type='password']")).to_be_visible()


def test_dashboard_redirects_anonymous_to_login(page: Page):
    page.goto(f"{BASE_URL}/dashboard/")
    expect(page).to_have_url(lambda url: "/accounts/login/" in url)
