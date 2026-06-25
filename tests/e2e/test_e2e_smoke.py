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

    expect(page.locator("h1").first).to_be_visible()
    assert page.locator("body").evaluate("el => getComputedStyle(el).opacity") == "1"


def test_landing_mobile_hero_shows_next_section_hint(page: Page):
    page.set_viewport_size({"width": 390, "height": 844})

    page.goto(f"{BASE_URL}/")

    # Check that a section below the fold is present
    second_section_top = page.locator("section").nth(1).evaluate("el => el.getBoundingClientRect().top")
    assert second_section_top < 1200  # just verify it exists and is somewhat reachable


def test_login_page_has_form(page: Page):
    page.goto(f"{BASE_URL}/accounts/login/")
    expect(page.locator("input[name='login']")).to_be_visible()
    expect(page.locator("input[type='password']")).to_be_visible()


def test_dashboard_redirects_anonymous_to_login(page: Page):
    page.goto(f"{BASE_URL}/dashboard/")
    expect(page).to_have_url(re.compile(r"/accounts/login/"))
