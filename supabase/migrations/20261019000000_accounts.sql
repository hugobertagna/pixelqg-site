-- PixelQG: accounts, licences, devices and the community Workshop (docs/ACCOUNTS.md §1).
-- Licences and devices are written only by Edge Functions with the service role key:
-- clients never get insert/update/delete on them.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (display_name is null or char_length(display_name) between 1 and 40),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, lower(new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ------------------------------------------------------------------ licences and devices
create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked', 'refunded')),
  source text not null default 'stripe' check (source in ('stripe', 'admin')),
  stripe_session_id text unique,
  stripe_payment_intent text unique,
  amount_total integer,
  currency text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses (id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  name text check (name is null or char_length(name) <= 60),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (license_id, device_hash)
);
create index devices_license_id_idx on public.devices (license_id);

-- At most 3 PCs per licence, enforced in the database so concurrent activations cannot exceed it.
create or replace function public.enforce_device_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.license_id::text));
  if (select count(*) from public.devices d where d.license_id = new.license_id) >= 3 then
    raise exception 'device_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger devices_limit
  before insert on public.devices
  for each row execute function public.enforce_device_limit();

-- ------------------------------------------------------------------ helpers used by RLS
-- They only answer about the caller (or for an admin), so nobody can probe other accounts.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select uid is not null and uid = auth.uid()
    and coalesce((select p.is_admin from public.profiles p where p.id = uid), false);
$$;

create or replace function public.has_active_license(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select uid is not null
    and (uid = auth.uid() or public.is_admin(auth.uid()))
    and exists (select 1 from public.licenses l where l.user_id = uid and l.status = 'active');
$$;

-- Trigger functions must not be callable through /rest/v1/rpc; has_active_license is only needed by
-- signed-in policies. is_admin stays executable by anon because the Workshop select policies
-- evaluate it for visitors (it answers false without a session).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.has_active_license(uuid) from public, anon;

-- ------------------------------------------------------------------ Workshop
create table public.workshop_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  repo_url text not null unique
    check (repo_url ~ '^https://github\.com/[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$'),
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 10 and 600),
  tags text[] not null default '{}' check (cardinality(tags) <= 6),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workshop_items_status_created_idx on public.workshop_items (status, created_at desc);

create table public.workshop_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.workshop_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 1000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);
create index workshop_comments_item_idx on public.workshop_comments (item_id, created_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workshop_items_touch
  before update on public.workshop_items
  for each row execute function public.touch_updated_at();

-- Public listings with the author's display name and never the e-mail. These views run with
-- their owner's rights on purpose (to read display names) and only expose published rows.
create view public.workshop_public as
  select i.id, i.user_id, i.repo_url, i.title, i.description, i.tags, i.created_at, i.updated_at,
         coalesce(p.display_name, 'Membre') as author_name
  from public.workshop_items i
  left join public.profiles p on p.id = i.user_id
  where i.status = 'published';

create view public.workshop_comments_public as
  select c.id, c.item_id, c.user_id, c.body, c.created_at,
         coalesce(p.display_name, 'Membre') as author_name
  from public.workshop_comments c
  join public.workshop_items i on i.id = c.item_id and i.status = 'published'
  left join public.profiles p on p.id = c.user_id
  where c.status = 'published';

grant select on public.workshop_public, public.workshop_comments_public to anon, authenticated;

-- ------------------------------------------------------------------ row level security
alter table public.profiles enable row level security;
alter table public.licenses enable row level security;
alter table public.devices enable row level security;
alter table public.workshop_items enable row level security;
alter table public.workshop_comments enable row level security;

-- profiles: own row, admins read all; only display_name is writable by users.
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- licences and devices: read-only for their owner (and admins).
create policy licenses_select_own on public.licenses for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
revoke insert, update, delete on public.licenses from anon, authenticated;

create policy devices_select_own on public.devices for select to authenticated
  using (exists (select 1 from public.licenses l
                 where l.id = devices.license_id
                   and (l.user_id = auth.uid() or public.is_admin(auth.uid()))));
revoke insert, update, delete on public.devices from anon, authenticated;

-- Workshop items: everyone reads published ones; licence holders publish and edit their own.
create policy items_select on public.workshop_items for select to anon, authenticated
  using (status = 'published' or user_id = auth.uid() or public.is_admin(auth.uid()));
create policy items_insert_licensed on public.workshop_items for insert to authenticated
  with check (user_id = auth.uid() and status = 'published' and public.has_active_license(auth.uid()));
create policy items_update_own on public.workshop_items for update to authenticated
  using (user_id = auth.uid() and status = 'published' and public.has_active_license(auth.uid()))
  with check (user_id = auth.uid() and status = 'published');
create policy items_update_admin on public.workshop_items for update to authenticated
  using (public.is_admin(auth.uid())) with check (true);
create policy items_delete_own_or_admin on public.workshop_items for delete to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Workshop comments: everyone reads; licence holders comment on published items.
create policy comments_select on public.workshop_comments for select to anon, authenticated
  using (status = 'published' or user_id = auth.uid() or public.is_admin(auth.uid()));
create policy comments_insert_licensed on public.workshop_comments for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'published' and public.has_active_license(auth.uid())
    and exists (select 1 from public.workshop_items i where i.id = item_id and i.status = 'published'));
create policy comments_update_admin on public.workshop_comments for update to authenticated
  using (public.is_admin(auth.uid())) with check (true);
create policy comments_delete_own_or_admin on public.workshop_comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ------------------------------------------------------------------ storage for app releases
-- Private bucket: only the `download` Edge Function (service role) hands out short signed links.
insert into storage.buckets (id, name, public) values ('releases', 'releases', false)
  on conflict (id) do nothing;
