# 🚀 Railway Deployment Checklist

## 1. Pre-deployment Setup

### Generate Django Secret Key
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```
Keep it safe - you'll need it for Railway.

### Test Production Settings Locally
```bash
# Test if production settings work
DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py check

# Collect static files
DJANGO_SETTINGS_MODULE=config.settings.prod python manage.py collectstatic --noinput
```

---

## 2. Railway Dashboard Setup

### Step 1: Create a New Project
- Go to [railway.app](https://railway.app)
- Click "New Project" → "Deploy from GitHub Repo"
- Select your repository

### Step 2: Add PostgreSQL Database
- In Railway Dashboard: "Add Service" → PostgreSQL
- Railway will automatically provide `DATABASE_URL` environment variable

### Step 3: Configure Environment Variables
In Railway Dashboard → **Variables** section, add:

```
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_SECRET_KEY=[YOUR_GENERATED_KEY_HERE]
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-app-name.railway.app
```

**Note:** Do NOT set `DATABASE_URL` - Railway provides it automatically via PostgreSQL plugin.

---

## 3. Dockerfile Configuration
✅ Already updated! The new Dockerfile:
- Builds CSS via Node.js (Tailwind)
- Installs Python dependencies
- Collects static files via WhiteNoise
- Runs gunicorn on port 8000

---

## 4. Create Procfile (Optional but Recommended)
Railway reads `Procfile` if it exists. Create this in root:

```
web: python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

Or use the Dockerfile (we already have it set).

---

## 5. Deploy to Railway

### Option A: Automatic Deploy (Recommended)
1. Commit all changes to Git
2. Push to your repository
3. Railway auto-deploys on push

### Option B: Manual Deploy
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link your project
railway link

# Deploy
railway up
```

---

## 6. Post-deployment Checks

### Check Deployment Status
```bash
railway logs
```

### Verify Database Connection
```bash
railway run python manage.py dbshell
```

### Create Superuser (if needed)
```bash
railway run python manage.py createsuperuser
```

### Run Migrations
```bash
railway run python manage.py migrate
```

---

## 7. Troubleshooting

### Port Issue
❌ If Railway app won't start:
- Check logs: `railway logs`
- Ensure Dockerfile exposes port 8000
- Ensure `PORT` environment variable is used (we use 0.0.0.0:8000)

### Static Files Not Loading
- Verify WhiteNoise middleware is in `MIDDLEWARE` ✅ Done
- Run: `python manage.py collectstatic --noinput`
- Check `STATIC_ROOT` is set to `./staticfiles`

### Database Connection Failed
- Verify PostgreSQL plugin is added in Railway Dashboard
- Check `DATABASE_URL` is auto-injected (don't set manually)
- Run migrations: `railway run python manage.py migrate`

### Media Files Upload Issues
For user-uploaded files (documents), Railway uses **ephemeral filesystem**.
**Solution (recommended):** Use a Railway persistent volume for `MEDIA_ROOT`.

- Add a **Volume** to the `web` service in Railway and mount it at `/data` (or another path).\n+- Set `RAILWAY_VOLUME_MOUNT_PATH=/data` (or your chosen mount path).\n+- The app will store uploads under `MEDIA_ROOT=/data/media` via `FileSystemStorage` (see `config/settings/prod.py`).\n+\n+**Alternative:** Configure S3-compatible storage:
```
USE_S3=True
AWS_STORAGE_BUCKET_NAME=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

---

## 8. Files Modified for Railway

✅ **Modified:**
- `Dockerfile` - Added Node build stage, gunicorn, migrations
- `config/wsgi.py` - Dynamic settings module selection
- `config/settings/base.py` - Added WhiteNoise middleware
- `requirements/base.txt` - Added `gunicorn`, `whitenoise`
- `.env.example` - Added Railway examples

✅ **Created:**
- `.env.railway` - Production environment template
- `RAILWAY_DEPLOYMENT.md` - This file

---

## 9. Environment Variables Summary

| Variable | Dev | Production (Railway) | Notes |
|----------|-----|----------------------|-------|
| `DJANGO_SETTINGS_MODULE` | dev | prod | Controls settings file |
| `DJANGO_SECRET_KEY` | any | **GENERATE NEW** | Never commit real key |
| `DJANGO_DEBUG` | True | False | Disable in production |
| `DJANGO_ALLOWED_HOSTS` | localhost | your-app.railway.app | HTTP_HOST validation |
| `DATABASE_URL` | sqlite | PostgreSQL (auto) | Railway provides it |
| `EMAIL_BACKEND` | console | SMTP | Configure email service |

---

## 10. Security Checklist

- ✅ `DJANGO_DEBUG=False` in production
- ✅ Secret key not committed to Git
- ✅ HTTPS enforced via `SECURE_PROXY_SSL_HEADER`
- ✅ CSRF and session cookies are secure
- ✅ XFrame options deny clickjacking
- ✅ Static files served via WhiteNoise

---

## 11. Next Steps

1. **Commit changes:**
   ```bash
   git add -A
   git commit -m "chore: configure for Railway deployment"
   git push
   ```

2. **Set up Railway project with your repo**

3. **Add PostgreSQL plugin in Railway Dashboard**

4. **Add environment variables in Railway Dashboard**

5. **Verify deployment in Railway logs**

---

Questions? Check:
- Railway Docs: https://docs.railway.app
- Django Deployment: https://docs.djangoproject.com/en/5.2/howto/deployment/
