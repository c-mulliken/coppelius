# Coppelius Deployment Guide

## Quick Start

This guide will deploy Coppelius to production in ~15 minutes.

## Prerequisites
- GitHub account
- Railway account (https://railway.app) - Sign up with GitHub
- Vercel account (https://vercel.com) - Sign up with GitHub
- Google OAuth credentials (https://console.cloud.google.com/apis/credentials)

## Step 1: Push to GitHub

```bash
cd /Users/cobymulliken/Documents/bellibrown
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Step 2: Deploy Backend to Railway

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your repository
4. Configure the service:
   - **Root Directory**: `backend`
   - **Start Command**: `npm start`
   - Railway will auto-detect Node.js

### Add PostgreSQL Database
1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will automatically create a `DATABASE_URL` environment variable

### Set Environment Variables
In Railway, go to your backend service → Variables tab and add:

```
NODE_ENV=production
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_CALLBACK_URL=https://<your-backend>.up.railway.app/auth/google/callback
SESSION_SECRET=<generate-a-random-string-here>
FRONTEND_URL=https://<will-add-after-vercel-deploy>
CAB_API_URL=https://cab.brown.edu/api/
```

**Note**:
- `DATABASE_URL` is automatically injected by Railway when you add PostgreSQL
- Replace placeholders with actual values
- Generate SESSION_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Get Your Backend URL
After deployment, Railway will give you a URL like `https://your-app-name.up.railway.app`

### Update Google OAuth
1. Go to https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**:
   - `https://your-backend-name.up.railway.app/auth/google/callback`
4. Save

## Step 3: Deploy Frontend to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Vercel will auto-detect Vite

### Configure Build Settings
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Set Environment Variables
In Vercel → Settings → Environment Variables:

```
VITE_API_URL=https://your-backend-url.railway.app
```

## Step 4: Update Frontend URL in Railway

Now that you have your Vercel URL:
1. Go back to Railway → Your backend service → Variables
2. Update `FRONTEND_URL` to your Vercel URL (e.g., `https://coppelius.vercel.app`)
3. Redeploy if needed

## Step 5: Populate Course Data

Once deployed, you need to scrape Brown's course catalog:

**Option A: Use Railway CLI** (recommended)
```bash
npm install -g @railway/cli
railway login
railway link  # Select your project
cd backend
railway run npm run scrape
```

**Option B: Manual**
- SSH into Railway container or run scraper locally against production DB

## Step 6: Test Production

1. Visit your Vercel URL
2. Click "Sign in with Brown Google"
3. Should redirect to Google OAuth
4. After auth, should redirect back to your app

## Costs

- **Railway**: $5/month (includes backend + PostgreSQL database)
- **Vercel**: Free for hobby projects
- **Domain** (optional): ~$12/year
- **Total**: $5/month or $72/year

## Troubleshooting

### CORS Errors
- Make sure `FRONTEND_URL` in backend .env matches your Vercel URL exactly
- Check Railway logs for CORS issues

### OAuth Not Working
- Verify redirect URIs in Google Console match exactly
- Check `GOOGLE_CALLBACK_URL` in Railway env vars

### Database Not Connecting
- Railway should auto-inject `DATABASE_URL`
- Check Railway logs for connection errors

## Post-Launch

- Add custom domain in Vercel (optional, ~$12/year)
- Set up monitoring (Railway has built-in metrics)
- Add error tracking (Sentry, LogRocket, etc.)
