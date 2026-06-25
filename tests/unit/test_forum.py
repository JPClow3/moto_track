from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from apps.core.models import SiteSettings
from apps.forum.models import ForumArticle


class ForumViewsTests(TestCase):
    def setUp(self):
        self.published = ForumArticle.objects.create(
            title="Como trocar oleo da XRE 300",
            slug="como-trocar-oleo-xre-300",
            summary="Guia rapido para troca de oleo em casa.",
            body="Passo 1: aqueça o motor.\nPasso 2: drene o oleo com cuidado.",
            is_published=True,
        )
        self.unpublished = ForumArticle.objects.create(
            title="Rascunho interno",
            slug="rascunho-interno",
            summary="Nao publicar",
            body="Conteudo em revisao.",
            is_published=False,
        )

    def test_forum_list_shows_only_published_articles(self):
        response = self.client.get(reverse("blog:list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.published.title)
        self.assertNotContains(response, self.unpublished.title)

    def test_forum_read_flow_list_to_detail(self):
        list_response = self.client.get(reverse("blog:list"))
        detail_response = self.client.get(reverse("blog:detail", args=[self.published.slug]))

        self.assertEqual(list_response.status_code, 200)
        self.assertContains(list_response, reverse("blog:detail", args=[self.published.slug]))
        self.assertEqual(detail_response.status_code, 200)
        self.assertContains(detail_response, self.published.body.splitlines()[0])

    def test_forum_detail_renders_lists_with_semantic_wrappers(self):
        article = ForumArticle.objects.create(
            title="Checklist de viagem",
            slug="checklist-de-viagem",
            summary="Itens para revisar antes de sair.",
            body="### Ferramentas\n- Chave 12\n- Alicate\n\n### Ordem\n1. Revisar oleo\n2. Conferir pneus",
            is_published=True,
        )

        response = self.client.get(reverse("blog:detail", args=[article.slug]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "<ul", html=False)
        self.assertContains(response, "<ol", html=False)
        self.assertNotContains(response, "<br><li", html=False)

    def test_forum_detail_blocks_unpublished_article(self):
        response = self.client.get(reverse("blog:detail", args=[self.unpublished.slug]))

        self.assertEqual(response.status_code, 404)

    def test_forum_detail_rejects_weird_slug_payload(self):
        response = self.client.get("/blog/%3Cscript%3Ealert(1)%3C/script%3E/")

        self.assertEqual(response.status_code, 404)

    def test_forum_article_sanitizes_script_content(self):
        article = ForumArticle.objects.create(
            title="Checklist de oleo",
            slug="checklist-oleo",
            summary="<script>alert(1)</script>Resumo limpo",
            body="Texto<script>alert(1)</script>seguro",
            is_published=True,
        )

        self.assertNotIn("<script>", article.summary)
        self.assertNotIn("<script>", article.body)

    def test_forum_list_query_budget(self):
        with CaptureQueriesContext(connection) as query_context:
            response = self.client.get(reverse("blog:list"))

        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(query_context), 4)

    def test_forum_list_does_not_create_site_settings(self):
        self.assertFalse(SiteSettings.objects.exists())

        response = self.client.get(reverse("blog:list"))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(SiteSettings.objects.exists())

    def test_forum_admin_add_requires_authentication(self):
        response = self.client.get(reverse("admin:forum_forumarticle_add"))

        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])
