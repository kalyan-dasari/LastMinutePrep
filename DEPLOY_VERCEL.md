# Deploy LastMinutePrep on Vercel

This guide gives you two paths:
- Path 1: Go live now with Vercel + Supabase free tiers
- Path 2: Alternative persistent production setup if you want to swap providers later

## First: Clear Confusion About GitHub Storage

Uploading files from a live Vercel app does not store them in your GitHub repo automatically.

Why:
- GitHub is source code storage, not runtime file storage.
- Vercel serverless runtime is ephemeral.
- Runtime writes are not committed back to git.

So if users upload PDFs, you need one of these:
- Temporary runtime storage (/tmp) for demo only
- Cloud storage for persistent files

## About Supabase Pricing

Supabase usually offers a free tier with limits.
That makes it a good fit for an early launch if your usage stays small.

For this project, Supabase can handle:
- PostgreSQL database
- File storage for PDFs
- Optional auth later if you ever want to move that too

If you prefer alternatives, you can use:
- Neon free tier for PostgreSQL
- Cloudinary free tier for PDF/file storage

## What Is Already Prepared in This Project

This project is now adjusted for Vercel compatibility:
- vercel.json is added
- SQLite still works locally for development
- On Vercel, if DATABASE_URL is set, the app uses Supabase Postgres
- On Vercel, if SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, PDF uploads go to Supabase Storage
- On Vercel, sessions use a Postgres-backed store when DATABASE_URL is available

This means it can go live with persistent data when Supabase is configured.

## Path 1: Go Live Now (Demo Mode)

Use this if you want a public URL quickly and still keep your data alive on free tiers.

### 1. Push code to GitHub

```bash
git add .
git commit -m "Prepare Vercel deployment"
git push
```

### 2. Import project into Vercel

- Open Vercel dashboard
- Add New Project
- Import your GitHub repository

### 3. Configure project

- Framework preset: Other
- Build command: leave empty
- Output directory: leave empty
- Install command: npm install

### 4. Add environment variables

- SESSION_SECRET = any long random secret
- NODE_ENV = production
- DATABASE_URL = your Supabase Postgres connection string
- SUPABASE_URL = your Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY = your Supabase service_role key (not anon, not publishable)
- SUPABASE_BUCKET = notes

Important:
- If DB password contains special characters like @ or :, URL-encode them in DATABASE_URL.
- In Supabase dashboard use Connect -> URI and copy the exact ready connection string.

### 5. Deploy

Click Deploy in Vercel dashboard.

Or CLI:

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

### 6. Result

You will get a live public domain immediately.

Important limitation if Supabase is not configured:
- Uploaded files and DB writes can reset because /tmp is not permanent.

If Supabase is configured, uploads and data persist.

## Path 2: Persistent Production (Free-Tier Friendly)

Use this if you want stable data and uploads.

### Recommended stack

- Database: Supabase Postgres free tier
- File storage: Supabase Storage free tier

### What the app already does now

When the environment variables are set, the app:
- Uses Supabase Postgres for the database
- Uses Supabase Storage for PDF files
- Uses Postgres-backed sessions on Vercel
- Keeps SQLite as a local fallback only for development

### Minimum setup tasks

1. Create a Supabase project.
2. Copy the project Postgres connection string into DATABASE_URL.
3. Create a public Storage bucket named notes.
4. Put the bucket name in SUPABASE_BUCKET.
5. Paste the project URL into SUPABASE_URL.
6. Paste the service role key into SUPABASE_SERVICE_ROLE_KEY.
7. Redeploy on Vercel.

## Vercel Checklist

- vercel.json exists in root
- server.js exists in root
- SESSION_SECRET set
- NODE_ENV set to production
- DATABASE_URL set
- SUPABASE_URL set
- SUPABASE_SERVICE_ROLE_KEY set
- SUPABASE_BUCKET set to notes
- No hardcoded localhost URLs

## Troubleshooting

### 404 / Function not found

- Ensure vercel.json routes all paths to server.js

### App deploys but data disappears

- Usually means DATABASE_URL or Supabase Storage variables are missing
- Confirm the Supabase connection string and bucket settings

### Uploads fail in production

- Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_BUCKET
- Make sure the bucket exists and is public

### 500 FUNCTION_INVOCATION_FAILED on Vercel

- Confirm Vercel project has all required env vars for Production environment.
- Confirm SUPABASE_SERVICE_ROLE_KEY is a service role secret key.
- Redeploy after changing any env var.
- Check Vercel Runtime Logs for the exact failing line.

### Sessions keep logging out

- Confirm DATABASE_URL is configured
- Confirm the app has permission to create the sessions table in Postgres

## My Recommendation For You

If budget is zero right now:
1. Launch with Vercel + Supabase free tier.
2. Keep the current codebase.
3. Grow first, then optimize later only if needed.

This is the fastest practical way to go live without blocking your launch.
