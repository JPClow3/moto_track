from __future__ import annotations

from django.db.models import Q, Count
from django.shortcuts import get_object_or_404, render, redirect
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST

from .models import ForumArticle, ForumCategory, ArticleComment, ArticleReaction


def forum_list_view(request):
    query = request.GET.get("q", "").strip()
    category_slug = request.GET.get("category", "").strip()

    articles = ForumArticle.objects.filter(is_published=True).prefetch_related("categories")
    
    if query:
        articles = articles.filter(
            Q(title__icontains=query) | Q(summary__icontains=query) | Q(body__icontains=query)
        )
    
    if category_slug:
        articles = articles.filter(categories__slug=category_slug)
        
    articles = articles.distinct().order_by("-published_at")
    categories = ForumCategory.objects.all()

    return render(request, "forum/list.html", {
        "articles": articles,
        "categories": categories,
        "query": query,
        "category_slug": category_slug,
    })


def forum_detail_view(request, slug: str):
    article = get_object_or_404(
        ForumArticle.objects.filter(is_published=True).prefetch_related(
            "categories", 
            "related_articles",
            "comments__author",
            "reactions"
        ),
        slug=slug,
    )
    
    reaction_counts = dict(
        article.reactions.values('emoji').annotate(count=Count('id')).values_list('emoji', 'count')
    )
    user_reaction = None
    if request.user.is_authenticated:
        try:
            user_reaction = article.reactions.filter(user_id=request.user.id).values_list('emoji', flat=True)[0]
        except IndexError:
            user_reaction = None

    return render(request, "forum/detail.html", {
        "article": article,
        "comments": article.comments.all(),
        "reaction_counts": reaction_counts,
        "user_reaction": user_reaction,
        "emojis": ["👍", "❤️", "🏍️"],
        "related": article.related_articles.filter(is_published=True)[:3],
    })


@login_required
@require_POST
def forum_add_comment(request, slug: str):
    article = get_object_or_404(ForumArticle, slug=slug, is_published=True)
    body = request.POST.get("body", "").strip()
    if body:
        ArticleComment.objects.create(article=article, author=request.user, body=body)
    return redirect("blog:detail", slug=slug)


@login_required
@require_POST
def forum_toggle_reaction(request, slug: str):
    article = get_object_or_404(ForumArticle, slug=slug, is_published=True)
    emoji = request.POST.get("emoji", "").strip()
    if emoji:
        reaction, created = ArticleReaction.objects.get_or_create(article=article, user=request.user, emoji=emoji)
        if not created:
            reaction.delete()
    return redirect("blog:detail", slug=slug)
