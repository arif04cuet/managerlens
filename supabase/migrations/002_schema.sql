-- Enums
create type user_role as enum ('super_admin', 'manager');
create type thread_status as enum ('active', 'stalled', 'resolved', 'dismissed');

-- Tenants
create table tenants (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  manager_email               text not null unique,
  tracking_email              text,
  email_credentials_secret_id uuid,           -- references vault.secrets(id)
  allowed_domains             text[] not null default '{}',
  banned_words                text[] not null default '{}',
  stalled_threshold_days      int  not null default 3,
  created_at                  timestamptz not null default now()
);

-- Users (extends auth.users)
create table users (
  id        uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  role      user_role not null default 'manager'
);

-- Threads
create table threads (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  subject         text not null,
  original_sender text not null,
  status          thread_status not null default 'active',
  waiting_on      text,
  ai_summary      text,
  last_email_date timestamptz not null default now()
);

-- Messages
create table messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references threads(id) on delete cascade,
  message_id  text not null unique,   -- IMAP/Gmail dedup key
  sender      text not null,
  body_snippet text,
  received_at timestamptz not null default now()
);

-- Indexes
create index on threads (tenant_id, status);
create index on threads (tenant_id, last_email_date);
create index on messages (thread_id);
