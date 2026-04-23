# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server
pnpm build        # production build (Next.js + Turbopack)
pnpm lint         # ESLint
pnpm exec tsc --noEmit   # type check only
```

To add Shadcn components: `pnpm dlx shadcn@latest add <component>`

## Environment Setup

Copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings (never expose to browser)
- `GEMINI_API_KEY` — from Google AI Studio
- `CRON_SECRET` — generate with `openssl rand -hex 32`

## Supabase Setup (run migrations in order)

Apply migrations from `supabase/migrations/` in the Supabase SQL editor:
1. `001_enable_vault.sql` — enables Supabase Vault extension
2. `002_schema.sql` — all 4 tables + enums + indexes
3. `003_rls.sql` — Row Level Security policies
4. `004_auth_trigger.sql` — syncs `auth.users` → `public.users` on signup

Then in Supabase Auth settings: enable "Email" provider, configure invite emails.

## Architecture

**Tech stack:** Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS + Shadcn UI + Supabase + Gemini AI

**Route guard:** `proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`, export must be `proxy`, not `middleware`). Redirects unauthenticated users to `/login`, blocks non-`super_admin` users from `/admin`.

**Supabase clients — three variants, never mix them up:**
- `lib/supabase/browser.ts` — browser components only (`"use client"`)
- `lib/supabase/server.ts` — Server Components and Route Handlers (reads cookies)
- `lib/supabase/service.ts` — service role, server-only, bypasses RLS (used by cron and admin API)

**Multi-tenancy:** enforced entirely by Supabase RLS. Every query from a manager client is automatically scoped to their `tenant_id`. The `get_my_user()` SQL function (defined in `003_rls.sql`) is the source of truth for role and tenant inside RLS policies.

**`tenant_id` in JWT:** Not automatic — Supabase does not include custom claims by default. The auth trigger in `004_auth_trigger.sql` syncs `tenant_id` + `role` from invite `user_metadata` into `public.users`. Route handlers and server components do a single `users` table lookup to get these values.

**Credential encryption:** `email_credentials_secret_id` in `tenants` stores a UUID reference to a Supabase Vault secret. Raw credentials are never stored in the DB. Read via `vault_decrypted_secret` RPC, written via `vault_create_secret` / `vault_update_secret` RPC — all using the service role client.

## Key Routes

| Route | Purpose |
|---|---|
| `/login` | Email + password sign-in |
| `/admin` | Super Admin: provision tenants, view tenant list |
| `/settings` | Manager: configure tracking email, filters, stalled threshold |
| `/dashboard` | Manager: real-time Kanban board (Active / Stalled / Resolved) |
| `POST /api/admin/create-tenant` | Creates tenant row + sends Supabase invite email |
| `POST /api/settings/update` | Updates tenant settings, writes credential to Vault |
| `GET /api/cron/ingest` | Email ingestion — called by Vercel Cron every 5 min |

## Ingestion Flow (`/api/cron/ingest`)

Authenticated via `Authorization: Bearer <CRON_SECRET>` header (set automatically by Vercel Cron).

1. Fetch all tenants with `tracking_email` + `email_credentials_secret_id` set
2. Decrypt app password from Vault via service role
3. `lib/email.ts` — connect via IMAP, fetch emails since last 7 days
4. Filter: skip if sender domain not in `allowed_domains`; skip if subject/body contains `banned_words`
5. Dedup by `messages.message_id` (IMAP message ID)
6. Thread grouping: normalize subject (strip Re:/Fwd:) → match existing thread or create new one
7. `lib/ai.ts` — send full thread to Gemini 1.5 Flash, get `{summary, waiting_on, is_resolved}`
8. Update `threads` with AI results; mark `resolved` if AI says so
9. Mark `stalled` any thread where `last_email_date < now() - stalled_threshold_days`

## Data Model Summary

- **`tenants`** — one row per manager workspace; holds filter config + vault secret reference
- **`users`** — maps `auth.users.id` → `tenant_id` + `role`; null `tenant_id` = super_admin
- **`threads`** — one per email conversation; grouped by normalized subject per tenant
- **`messages`** — individual emails; `message_id` is the IMAP dedup key

## Realtime

Dashboard subscribes to `postgres_changes` on the `threads` table filtered by `tenant_id`. Supabase Realtime must be enabled for the `threads` table in the Supabase dashboard (Table Editor → Realtime toggle).
