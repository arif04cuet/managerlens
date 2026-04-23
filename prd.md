# Product Requirements Document (PRD)
**Product Name:** ManagerLens  
**Document Version:** 2.0 (Multi-Tenant Edition)  
**Target Platform:** Web (Single Page Application / SaaS)

---

## 1. Title & Scope
**Title:** An AI-powered, multi-tenant dashboard that turns manager CCs into an automated tracking board.

**Scope:** ManagerLens is a zero-manual-entry tracking tool for managers. A Super Admin provisions accounts for organizations/managers. Each manager gets a secure, isolated workspace to configure their tracking email and custom filtering rules. The system automatically ingests, filters, and processes emails via AI, presenting them on a real-time Kanban board.

---

## 2. Target Audience
- **Super Admin:** System owner who provisions and manages tenant workspaces.
- **Managers (Tenants):** Mid-to-Senior level managers tracking cross-functional requests.

---

## 3. Core Workflows

### A. Onboarding (Super Admin → Manager)
1. Super Admin logs in and creates a new Tenant (name + manager email).
2. System sends a Supabase invite email to the Manager.
3. Manager sets password and logs in.
4. Manager visits `/settings` to configure tracking email credentials and filters.

### B. Daily Tracking (Zero Manual Entry)
1. Employees CC the manager's configured tracking email.
2. Cron job (every 5 min) fetches emails per tenant, applies domain/banned-word filters.
3. Valid emails sent to AI for summary, bottleneck, and resolution-intent detection.
4. Dashboard updates in real-time via Supabase Realtime WebSocket.

---

## 4. Feature Requirements

### P0 — MVP
- Multi-tenant auth (Super Admin + Manager roles via Supabase Auth)
- Row Level Security — managers see only their tenant's data
- Tenant settings: tracking email credentials, `allowed_domains`, `banned_words`, `stalled_threshold_days`
- Email ingestion cron with domain + banned-word filtering
- Real-time Kanban dashboard (Active / Stalled / Resolved)

### P1 — AI & Efficiency
- AI summarization (1–2 sentences) and `waiting_on` person extraction
- Stagnation flagging: threads older than `stalled_threshold_days` with no reply → marked `stalled`
- Auto-resolution: AI detects "Done/Approved" intent → marks thread `resolved`

### P2 — Future
- Multiple tracking emails per tenant
- Nudge email templates for delayed users

---

## 5. Technical Architecture

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS + Shadcn UI | Vercel Free Tier |
| Auth + DB | Supabase (PostgreSQL + Auth + Realtime) | Free Tier, built-in RLS |
| Credential Encryption | **Supabase Vault** | Native Supabase support |
| Email Ingestion | Vercel Cron + Supabase Edge Functions | Serverless, free |
| AI Engine | Google Gemini API or Groq API | Free Tier |

**Resolved architectural decisions:**
- `tenant_id` in JWT: populated via a Supabase `auth.users` trigger that syncs the `public.users` table; route middleware does a single `users` table lookup to get `tenant_id` and `role`.
- Stalled threshold: configurable per tenant via `stalled_threshold_days` (default: 3). A cron job or DB function compares `last_email_date + stalled_threshold_days` against `now()`.
- Cron runs with Supabase **service role** key — it decrypts credentials and accesses all tenants.

---

## 6. Data Model

### `tenants`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | text | Org or manager name |
| `manager_email` | text | Login email |
| `tracking_email` | text | Inbox being monitored |
| `email_credentials_secret_id` | UUID | Supabase Vault secret reference |
| `allowed_domains` | text[] | e.g. `["company.com"]` |
| `banned_words` | text[] | e.g. `["newsletter"]` |
| `stalled_threshold_days` | int | Default 3 |
| `created_at` | timestamptz | |

### `users` (extends Supabase Auth)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Maps to `auth.users.id` |
| `tenant_id` | UUID FK → tenants | null for super_admin |
| `role` | enum | `super_admin` \| `manager` |

### `threads`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK → tenants | |
| `subject` | text | |
| `original_sender` | text | |
| `status` | enum | `active` \| `stalled` \| `resolved` \| `dismissed` |
| `waiting_on` | text | AI-extracted person |
| `ai_summary` | text | 1–2 sentence AI summary |
| `last_email_date` | timestamptz | |

### `messages`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `thread_id` | UUID FK → threads | |
| `message_id` | text | IMAP/Gmail message ID (dedup key) |
| `sender` | text | |
| `body_snippet` | text | |
| `received_at` | timestamptz | |

---

## 7. RLS Policies

| Table | Super Admin | Manager |
|---|---|---|
| `tenants` | All | SELECT + UPDATE where `id = own tenant_id` |
| `users` | All | SELECT own row |
| `threads` | All | SELECT + UPDATE + DELETE where `tenant_id = own tenant_id` |
| `messages` | All | SELECT where thread's `tenant_id = own tenant_id` |

`email_credentials_secret_id` stores a reference to a Supabase Vault secret — raw credentials never exposed in query results.

---

## 8. Implementation Phases

### Phase 0 — Scaffold
- `create-next-app` with TypeScript, Tailwind, App Router
- Shadcn UI init
- Folder structure: `app/`, `components/`, `lib/supabase/`, `supabase/migrations/`
- `.env.example` with all required keys
- Supabase client helpers (browser + server + service-role)

### Phase 1 — DB + RLS
- SQL migrations for all 4 tables
- Enable Supabase Vault (`vault` extension)
- RLS policies
- `auth.users` trigger to populate `public.users` on signup

### Phase 2 — Auth + Middleware
- Login page (email/password)
- Next.js middleware for route protection
- Role-based redirect: `super_admin` → `/admin`, `manager` → `/dashboard`

### Phase 3 — Super Admin `/admin`
- Tenant list + create form
- `inviteUserByEmail` via Supabase Admin API
- Inserts row into `tenants` + `users`

### Phase 4 — Manager `/settings`
- Form: tracking email, app password/OAuth token (written to Vault), `allowed_domains`, `banned_words`, `stalled_threshold_days`
- Credentials stored as Vault secret; only `email_credentials_secret_id` saved to `tenants`

### Phase 5 — `/dashboard` Kanban (mocked data)
- Three columns: Active / Stalled / Resolved
- Thread cards with subject, sender, AI summary, `waiting_on`, stalled indicator
- Supabase Realtime subscription scoped to `tenant_id`

### Phase 6 — Email Ingestion Cron
- Vercel Cron (`/api/cron/ingest`) every 5 min, authenticated with `CRON_SECRET`
- Supabase Edge Function (or Next.js route handler with service role):
  1. Query all active tenants
  2. Decrypt credentials from Vault
  3. Connect via IMAP/Gmail API
  4. Apply `allowed_domains` and `banned_words` filters
  5. Upsert new messages into `messages` table

### Phase 7 — AI Layer
- Send email thread to Gemini/Groq
- Extract: 1–2 sentence summary, `waiting_on` person, resolution intent
- Update `threads.ai_summary`, `threads.waiting_on`, `threads.status`
- Stalled check: if `now() - last_email_date > stalled_threshold_days` → status = `stalled`

### Phase 8 — Full Integration
- Wire ingestion (Phase 6) → AI (Phase 7) → DB → Realtime dashboard (Phase 5)
- End-to-end test: send a real CC email, watch it appear on the board
