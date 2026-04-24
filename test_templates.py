#!/usr/bin/env python
"""Verify key templates render without errors after recent changes."""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

import django
django.setup()

from django.template import engines
from django.test import RequestFactory
from django.contrib.auth.models import AnonymousUser

engine = engines['django']
templates_to_check = [
    'base.html',
    'allauth/layouts/base.html',
    'core/dashboard.html',
    'core/onboarding.html',
    'core/landing.html',
    'reminders/list.html',
    'documents/list.html',
    'fuel/list.html',
    'maintenance/list.html',
    'maintenance/partials/quick_form.html',
    'fuel/partials/quick_form.html',
    'reports/sale_report.html',
]

errors = []
for name in templates_to_check:
    try:
        t = engine.get_template(name)
        # Try to render with minimal context
        rf = RequestFactory()
        request = rf.get('/')
        request.user = AnonymousUser()
        request.resolver_match = None
        ctx = {'request': request}
        t.render(ctx)
        print(f"OK: {name}")
    except Exception as e:
        errors.append((name, type(e).__name__, str(e)[:200]))
        print(f"FAIL: {name} — {type(e).__name__}: {str(e)[:200]}")

if errors:
    print(f"\n{len(errors)} template(s) failed")
    sys.exit(1)
else:
    print(f"\nAll {len(templates_to_check)} templates OK")
    sys.exit(0)
