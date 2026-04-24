import re

from django import template
from django.utils.html import conditional_escape
from django.utils.safestring import mark_safe

register = template.Library()


def _render_inline(text):
    escaped = conditional_escape(text)
    return re.sub(r"\*\*(.+?)\*\*", r'<strong class="font-bold">\1</strong>', escaped)


def _flush_list(parts, list_type, items):
    if not items:
        return
    list_class = "space-y-2 pl-5"
    item_class = "text-base leading-7 text-on-surface"
    rendered_items = "".join(f'<li class="{item_class}">{_render_inline(item)}</li>' for item in items)
    parts.append(f'<{list_type} class="{list_class}">{rendered_items}</{list_type}>')
    items.clear()


def _flush_paragraph(parts, lines):
    if not lines:
        return
    paragraph = " ".join(lines)
    parts.append(f'<p class="text-base leading-7 text-on-surface">{_render_inline(paragraph)}</p>')
    lines.clear()


@register.filter(name="markdown_lite")
def markdown_lite(value):
    if not value:
        return ""

    parts = []
    paragraph_lines = []
    list_items = []
    list_type = None

    for raw_line in value.splitlines():
        line = raw_line.strip()
        if not line:
            _flush_paragraph(parts, paragraph_lines)
            _flush_list(parts, list_type, list_items)
            list_type = None
            continue

        header_match = re.match(r"^###\s+(.*)$", line)
        if header_match:
            _flush_paragraph(parts, paragraph_lines)
            _flush_list(parts, list_type, list_items)
            list_type = None
            parts.append(
                '<h3 class="text-xl font-bold mt-6 mb-3 text-on-surface">'
                f"{_render_inline(header_match.group(1))}"
                "</h3>"
            )
            continue

        bullet_match = re.match(r"^- (.*)$", line)
        if bullet_match:
            _flush_paragraph(parts, paragraph_lines)
            if list_type not in (None, "ul"):
                _flush_list(parts, list_type, list_items)
            list_type = "ul"
            list_items.append(bullet_match.group(1))
            continue

        ordered_match = re.match(r"^\d+\.\s+(.*)$", line)
        if ordered_match:
            _flush_paragraph(parts, paragraph_lines)
            if list_type not in (None, "ol"):
                _flush_list(parts, list_type, list_items)
            list_type = "ol"
            list_items.append(ordered_match.group(1))
            continue

        _flush_list(parts, list_type, list_items)
        list_type = None
        paragraph_lines.append(line)

    _flush_paragraph(parts, paragraph_lines)
    _flush_list(parts, list_type, list_items)
    # All user input is escaped via conditional_escape in _render_inline before mark_safe.
    return mark_safe("".join(parts))  # nosec
