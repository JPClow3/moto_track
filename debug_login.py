import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.test')
django.setup()
from django.test import Client
from django.urls import reverse
from django.contrib.auth import get_user_model
User = get_user_model()
client = Client()
user = User.objects.create_user(username='testuser2', password='pass12345')
user.emailaddress_set.create(email='test2@example.com', primary=True, verified=True)
response = client.post(reverse('account_login'), {'login': 'test2@example.com', 'password': 'pass12345'})
with open('debug_login_result.txt', 'w') as f:
    f.write(f'STATUS: {response.status_code}\n')
    if response.status_code == 200:
        f.write(response.content.decode()[:2000])
