from __future__ import annotations

from django.shortcuts import get_object_or_404, render

from .models import ForumArticle


def forum_list_view(request):
    articles = ForumArticle.objects.filter(is_published=True).only(
        "title", "slug", "summary", "published_at", "cover_image"
    )
    return render(request, "forum/list.html", {"articles": articles})


def forum_detail_view(request, slug: str):
    article = get_object_or_404(
        ForumArticle.objects.filter(is_published=True).only(
            "title", "slug", "summary", "body", "published_at", "updated_at", "meta_description", "cover_image"
        ),
        slug=slug,
    )
    return render(request, "forum/detail.html", {"article": article})
