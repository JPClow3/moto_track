from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar

from django.core.paginator import Page, Paginator
from django.http import HttpRequest

T = TypeVar("T")


@dataclass(frozen=True)
class Paginated(Generic[T]):
    page: Page
    items: list[T]


def paginate(request: HttpRequest, queryset, *, per_page: int = 50, page_param: str = "page") -> Paginated:
    paginator = Paginator(queryset, per_page)
    page = paginator.get_page(request.GET.get(page_param) or 1)
    return Paginated(page=page, items=list(page.object_list))
