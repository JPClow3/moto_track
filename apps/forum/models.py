from __future__ import annotations

from uuid import uuid4

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import TimeStampedModel
from apps.core.sanitizers import sanitize_text


class ForumCategory(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Forum categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class ForumArticle(models.Model):
    title = models.CharField(max_length=180)
    slug = models.SlugField(max_length=180, unique=True)
    summary = models.CharField(max_length=280)
    meta_description = models.CharField(max_length=280, blank=True, help_text="Descricao para SEO/metas. Deixe em branco para usar o resumo.")
    cover_image = models.ImageField(upload_to="blog/covers/%Y/%m/", blank=True, help_text="Imagem de capa para Open Graph (recomendado 1200x630).")
    body = models.TextField()
    is_published = models.BooleanField(default=True, db_index=True)
    published_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    categories = models.ManyToManyField(ForumCategory, blank=True, related_name="articles")
    related_articles = models.ManyToManyField("self", blank=True)


    class Meta:
        ordering = ("-published_at", "-id")

    def __str__(self):
        return self.title

    @property
    def estimated_reading_time(self) -> int:
        import math
        word_count = len((self.body or "").split())
        return max(1, math.ceil(word_count / 200))

    def save(self, *args, **kwargs):
        self.summary = sanitize_text(self.summary).strip()
        self.body = sanitize_text(self.body).strip()
        if not self.slug:
            base_slug = slugify(self.title)[:160] or f"artigo-{uuid4().hex[:10]}"
            slug = base_slug
            counter = 1
            while ForumArticle.objects.filter(slug=slug).exclude(pk=self.pk or 0).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class ArticleComment(TimeStampedModel):
    article = models.ForeignKey(ForumArticle, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.TextField()

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.author} on {self.article}"


class ArticleReaction(models.Model):
    article = models.ForeignKey(ForumArticle, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("article", "user", "emoji")]

    def __str__(self):
        return f"{self.user} reacted {self.emoji} on {self.article}"
