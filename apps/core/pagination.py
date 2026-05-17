from __future__ import annotations

from dataclasses import dataclass

from django.core.paginator import Page, Paginator
from django.http import HttpRequest


@dataclass(frozen=True)
class Paginated[T]:
    page: Page
    items: list[T]


_MIN_PER_PAGE = 1
_MAX_PER_PAGE = 100


def paginate(
    request: HttpRequest,
    queryset,
    *,
    per_page: int = 50,
    page_param: str = "page",
    per_page_param: str = "per_page",
) -> Paginated:
    """Paginate a queryset.

    B-L4: when the client supplies `per_page`, clamp it to [1, 100] so that a
    hostile or buggy client cannot request `per_page=1` (which generates one
    page per row for big tables) or `per_page=1_000_000` (which loads the whole
    table into memory).
    """
    requested = request.GET.get(per_page_param)
    if requested is not None:
        try:
            per_page = int(requested)
        except (TypeError, ValueError):
            pass  # fall back to the caller-supplied default
    per_page = max(_MIN_PER_PAGE, min(_MAX_PER_PAGE, per_page))
    paginator = Paginator(queryset, per_page)
    page = paginator.get_page(request.GET.get(page_param) or 1)
    return Paginated(page=page, items=list(page.object_list))
