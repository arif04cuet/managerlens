# ManagerLens

Email thread tracking for managers. Automatically ingests emails from a dedicated tracking inbox, groups them into threads, and surfaces active, stalled, and resolved conversations on a clean dashboard.

## Features

- **Email ingestion** — connects via IMAP, fetches new emails on a cron schedule, deduplicates by message ID
- **Thread grouping** — normalises subject lines (`Re:`, `Fwd:` stripped) to group replies into the same thread
- **Stalled detection** — threads with no reply after a configurable number of days are automatically marked Stalled
- **Dashboard** — filterable list view (All / Active / Stalled / Resolved) with real-time updates
- **Thread timeline** — full message history with a two-column timeline layout; system events (e.g. resolved) appear as markers
- **Manual actions** — manager can mark any thread as Resolved or Dismiss it
- **Multi-tenancy** — each manager has an isolated workspace enforced by Supabase RLS
- **Credential security** — IMAP app passwords stored encrypted in Supabase Vault, never in plain text

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS + Shadcn UI |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (email/password + invite flow) |
| Secrets | Supabase Vault |
| Email | IMAP via `imapflow` |
| Cron | Vercel Cron (`vercel.json`) |
| Deployment | Vercel |

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/arif04cuet/managerlens.git
cd managerlens
pnpm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
CRON_SECRET=        # openssl rand -hex 32
```

### 3. Supabase setup

Run migrations in order from `supabase/migrations/` in the Supabase SQL editor:

1. `001_enable_vault.sql`
2. `002_schema.sql`
3. `003_rls.sql`
4. `004_auth_trigger.sql`
5. `005_vault_wrappers.sql`
6. `006_last_ingested_at.sql`
7. `007_add_recipients_to_threads.sql`
8. `008_add_created_at_to_threads.sql`
9. `009_threads_replica_identity_full.sql`

In Supabase Auth settings: enable the **Email** provider.

### 4. Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login`.

### 5. Trigger the ingest cron manually

```bash
curl -X GET http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer <your CRON_SECRET>"
```

## Key Routes

| Route | Description |
|---|---|
| `/login` | Email + password sign-in |
| `/signup` | Invite landing page — set password |
| `/admin` | Super admin: provision tenants |
| `/dashboard` | Manager: thread list with filters |
| `/dashboard/[id]` | Thread detail + timeline |
| `/settings` | Manager: configure tracking email & filters |
| `GET /api/cron/ingest` | Email ingestion (called by Vercel Cron) |

## Deployment

Deploy to Vercel and set the environment variables. The `vercel.json` cron job calls `/api/cron/ingest` every 5 minutes automatically.

```bash
vercel --prod
```
