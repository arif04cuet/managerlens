-- Helper: get the current user's row from public.users
create or replace function get_my_user()
returns users language sql security definer stable as $$
  select * from users where id = auth.uid()
$$;

-- ── tenants ──────────────────────────────────────────────────────────────────
alter table tenants enable row level security;

create policy "super_admin: all" on tenants
  for all using ((get_my_user()).role = 'super_admin');

create policy "manager: own tenant read" on tenants
  for select using ((get_my_user()).tenant_id = id);

create policy "manager: own tenant update" on tenants
  for update using ((get_my_user()).tenant_id = id);

-- ── users ────────────────────────────────────────────────────────────────────
alter table users enable row level security;

create policy "super_admin: all" on users
  for all using ((get_my_user()).role = 'super_admin');

create policy "manager: own row" on users
  for select using (id = auth.uid());

-- ── threads ──────────────────────────────────────────────────────────────────
alter table threads enable row level security;

create policy "super_admin: all" on threads
  for all using ((get_my_user()).role = 'super_admin');

create policy "manager: own tenant" on threads
  for all using ((get_my_user()).tenant_id = tenant_id);

-- ── messages ─────────────────────────────────────────────────────────────────
alter table messages enable row level security;

create policy "super_admin: all" on messages
  for all using ((get_my_user()).role = 'super_admin');

create policy "manager: own tenant threads" on messages
  for select using (
    exists (
      select 1 from threads t
      where t.id = thread_id
        and t.tenant_id = (get_my_user()).tenant_id
    )
  );
