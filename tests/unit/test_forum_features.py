import pytest
from django.urls import reverse
from apps.forum.models import ForumArticle, ForumCategory, ArticleComment, ArticleReaction

@pytest.mark.django_db
def test_forum_add_comment(client, django_user_model):
    user = django_user_model.objects.create(username="testuser", password="password")
    client.force_login(user)
    article = ForumArticle.objects.create(title="Test", slug="test", is_published=True)
    url = reverse("blog:add_comment", kwargs={"slug": "test"})
    response = client.post(url, {"body": "My comment"})
    assert response.status_code == 302
    assert ArticleComment.objects.filter(article=article, author=user, body="My comment").exists()

@pytest.mark.django_db
def test_forum_toggle_reaction(client, django_user_model):
    user = django_user_model.objects.create(username="testuser", password="password")
    client.force_login(user)
    article = ForumArticle.objects.create(title="Test", slug="test", is_published=True)
    url = reverse("blog:toggle_reaction", kwargs={"slug": "test"})
    response = client.post(url, {"emoji": "👍"})
    assert response.status_code == 302
    assert ArticleReaction.objects.filter(article=article, user=user, emoji="👍").exists()
