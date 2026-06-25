from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.forum.models import ForumArticle


class PublicUiShellTests(TestCase):
    def test_public_and_auth_pages_render_theme_logo_markup(self):
        route_names = [
            "landing",
            "pricing",
            "account_login",
            "account_signup",
            "privacy_policy",
            "terms_of_service",
        ]

        for route_name in route_names:
            with self.subTest(route=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, "data-theme-logo")
                self.assertContains(response, "moto-track-logo-horizontal-light.svg")
                self.assertContains(response, "moto-track-logo-horizontal-dark.svg")

    def test_public_theme_controls_are_icon_only_without_lucide_bundle(self):
        route_names = [
            "landing",
            "pricing",
            "blog:list",
        ]

        for route_name in route_names:
            with self.subTest(route=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, "data-theme-toggle")
                self.assertContains(response, "ui-icon-btn")
                self.assertContains(response, "<svg")
                self.assertNotContains(response, 'data-lucide="sun"')
                self.assertNotContains(response, "vendor/lucide")
                self.assertNotContains(response, "<span>Tema</span>")

    def test_auth_theme_controls_keep_icon_only_before_js_runs(self):
        route_names = [
            "account_login",
            "account_signup",
        ]

        for route_name in route_names:
            with self.subTest(route=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, "data-theme-toggle")
                self.assertContains(response, 'data-lucide="sun"')
                self.assertContains(response, "ui-icon-btn")
                self.assertNotContains(response, "<span>Tema</span>")
                self.assertNotContains(response, 'class="ui-toolbar-btn" data-theme-toggle')

    def test_landing_has_trust_plan_teaser_and_semantic_preview(self):
        response = self.client.get(reverse("landing"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Grátis para começar.")
        self.assertContains(response, "Criar Conta Grátis")
        self.assertContains(response, "Telemetria de Consumo")
        self.assertContains(response, "Manutenção Preditiva")
        self.assertContains(response, "Dossiê e Valorização")

    def test_reviewed_marketing_pages_use_normal_tracking_markup(self):
        route_names = ["pricing"]

        for route_name in route_names:
            with self.subTest(route=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertNotContains(response, "tracking-tight")
                self.assertNotContains(response, "tracking-wider")
                self.assertNotContains(response, "tracking-widest")

    def test_legal_pages_do_not_render_auth_card_or_auth_fields(self):
        User = get_user_model()
        user = User.objects.create_user(username="public-ui-user", email="public@example.com", password="pass12345")
        route_names = [
            "privacy_policy",
            "terms_of_service",
            "lgpd",
            "cancellation_policy",
        ]

        for authenticated in (False, True):
            if authenticated:
                self.client.force_login(user)
            else:
                self.client.logout()
            for route_name in route_names:
                with self.subTest(route=route_name, authenticated=authenticated):
                    response = self.client.get(reverse(route_name))
                    self.assertEqual(response.status_code, 200)
                    self.assertContains(response, 'class="legal-document"')
                    self.assertNotContains(response, "Bem-vindo de volta")
                    self.assertNotContains(response, 'name="login"')
                    self.assertNotContains(response, 'type="password"')
                    self.assertNotContains(response, "A garagem digital para cuidar da sua moto")
                    self.assertNotContains(response, 'id="quick-add-trigger"')
                    self.assertNotContains(response, 'aria-label="Navegação rápida"')

    def test_blog_pages_use_public_shell_even_for_authenticated_users(self):
        User = get_user_model()
        user = User.objects.create_user(username="blog-public-user", email="blog-public@example.com", password="pass12345")
        article = ForumArticle.objects.create(
            title="Checklist de manutenção preventiva",
            slug="checklist-manutencao-preventiva",
            summary="Itens essenciais para revisar antes de sair.",
            body="### Freios\nVerifique pastilhas e fluido.",
            is_published=True,
        )
        self.client.force_login(user)

        urls = [
            reverse("blog:list"),
            reverse("blog:detail", args=[article.slug]),
        ]

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, "data-theme-logo")
                self.assertNotContains(response, 'id="quick-add-trigger"')
                self.assertNotContains(response, 'aria-label="Navegação rápida"')
                self.assertNotContains(response, "Moto ativa")
                self.assertNotContains(response, "Sair</button>")

    def test_auth_pages_keep_auth_fields(self):
        login_response = self.client.get(reverse("account_login"))
        self.assertEqual(login_response.status_code, 200)
        self.assertContains(login_response, "Bem-vindo de volta")
        self.assertContains(login_response, 'name="login"')
        self.assertContains(login_response, 'type="password"')
        self.assertContains(login_response, '<meta name="robots" content="noindex, nofollow" />')
        self.assertContains(login_response, '<link rel="canonical" href="http://testserver/accounts/login/"')

        signup_response = self.client.get(reverse("account_signup"))
        self.assertEqual(signup_response.status_code, 200)
        self.assertContains(signup_response, "Crie sua conta Moto Track")
        self.assertContains(signup_response, 'name="email"')
        self.assertContains(signup_response, 'name="password1"')
        self.assertContains(signup_response, '<meta name="robots" content="noindex, nofollow" />')
        self.assertContains(signup_response, '<link rel="canonical" href="http://testserver/accounts/signup/"')

    def test_blog_detail_includes_article_structured_data_and_clean_canonical(self):
        article = ForumArticle.objects.create(
            title="Checklist de revisão",
            slug="checklist-revisao",
            summary="Resumo curto do guia.",
            body="Conteúdo técnico.",
            is_published=True,
        )

        response = self.client.get(f"{reverse('blog:detail', args=[article.slug])}?utm_source=test")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '"@type": "Article"')
        self.assertContains(response, '<link rel="canonical" href="http://testserver/blog/checklist-revisao/"')
        self.assertContains(response, '<meta property="og:url" content="http://testserver/blog/checklist-revisao/"')
        self.assertNotContains(response, "utm_source=test")
