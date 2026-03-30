# Commute Alert (Next.js + Google Maps)

This app lets you create multiple commute alerts (for example San Francisco <-> Emeryville), monitor traffic in near real time, and notify you by ntfy push when your conditions are met.

## What It Supports

- Multiple saved alerts with different routes and schedules
- Threshold rules:
  - Max total commute minutes
  - Min delay minutes over baseline
  - Optional severe-weather requirement
  - Optional traffic-incident keyword match (for Bay Bridge-focused checks)
- Notification channels:
  - ntfy push notifications
- Manual run (`Run Check Now`) plus automatic scheduled checks (GitHub Actions every 5 minutes)
- Username/password authentication with secure session cookies

## 1) Setup

Copy env file:

```bash
cp .env.example .env.local
```

Fill in your keys in `.env.local`:

- `DATABASE_URL` (required, Neon pooled Postgres URL)
- `GOOGLE_MAPS_API_KEY` (required)
- `API_511_KEY` (optional, for Bay Area incidents)
- `NTFY_TOPIC` (optional, for push)
- `NTFY_BASE_URL` (optional, defaults to `https://ntfy.sh`)
- `NTFY_ACCESS_TOKEN` (optional if using authenticated ntfy server)

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

When you first open the app, create an account and then log in.

## 2) How Alerts Trigger

An alert runs only when:

- It is enabled
- Current day is in `daysOfWeekCsv`
- Current time is within the configured start/end window

When it runs, the app checks:

- Current traffic route duration vs baseline from Google Maps
- Severe weather (NOAA/NWS endpoint)
- Bay Bridge incident list (511.org, if configured)

If your configured rule(s) match, and cooldown + consecutive-trigger constraints are satisfied, notifications are sent.

## 3) Deployment (Vercel)

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add all environment variables in Vercel project settings.
4. Set `DATABASE_URL` to your Neon pooled Postgres URL.
5. Deploy the project on Vercel Hobby (no Vercel cron required).

## 4) Scheduler for Vercel Hobby (GitHub Actions)

Vercel Hobby allows only daily cron jobs, so this project uses GitHub Actions for 5-minute checks.

1. In your GitHub repo, go to `Settings` -> `Secrets and variables` -> `Actions`.
2. Create these repository secrets:
   - `APP_BASE_URL`: your production URL (example `https://your-app.vercel.app`)
   - `CRON_SECRET`: same secret value you put in Vercel env vars
3. The workflow file `.github/workflows/check-alerts.yml` runs every 5 minutes and calls:
   - `GET /api/cron/check-alerts`
   - with header `x-cron-secret`
4. You can also run it manually from the Actions tab using `workflow_dispatch`.

In production, set `CRON_SECRET` and configure your cron caller to send:

- `Authorization: Bearer <CRON_SECRET>` or
- `x-cron-secret: <CRON_SECRET>`

## Important Safety/Cost Notes

- Google Maps API calls cost money after free-tier limits.
- Start with one alert and a larger cooldown (for example 45-60 minutes) to avoid noisy/expensive notification bursts.
- This app is currently single-user and does not include login/auth yet.
