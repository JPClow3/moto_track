from django import template

from apps.core.formatting import format_brl, format_decimal

register = template.Library()


@register.filter
def brl(value):
    return format_brl(value)


@register.filter
def decimal_comma(value, places=2):
    try:
        places = int(places)
    except (TypeError, ValueError):
        places = 2
    return format_decimal(value, places, trim=False)


@register.filter
def decimal_trim(value, places=2):
    try:
        places = int(places)
    except (TypeError, ValueError):
        places = 2
    return format_decimal(value, places, trim=True)
