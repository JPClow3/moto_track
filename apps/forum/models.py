from __future__ import annotations

from uuid import uuid4

from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.sanitizers import sanitize_text


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

    class Meta:
        ordering = ("-published_at", "-id")

    def __str__(self):
        return self.title

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
