-- Free 7-day trial (one per PC, started by the app on first activation), Lemon Squeezy orders,
-- and the launch waitlist. Paid licences keep status 'active'; trials use status 'trial'.

alter table public.licenses drop constraint licenses_status_check;
alter table public.licenses add constraint licenses_status_check
  check (status in ('active', 'trial', 'revoked', 'refunded'));

alter table public.licenses drop constraint licenses_source_check;
alter table public.licenses add constraint licenses_source_check
  check (source in ('stripe', 'admin', 'trial', 'lemonsqueezy'));

alter table public.licenses add column trial_ends_at timestamptz;
alter table public.licenses add column provider_order_id text unique;

-- A PC can start only one trial ever, whatever the account: no fresh trial by creating new accounts.
-- No policy: only Edge Functions (service role) read or write it.
create table public.trial_devices (
  device_hash text primary key check (device_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now()
);
alter table public.trial_devices enable row level security;
revoke all on public.trial_devices from anon, authenticated;

-- Launch waitlist: anyone may add an e-mail, nobody can read the list from the site.
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254 and email ~* '^[^[:space:]@<>"]+@[^[:space:]@<>"]+\.[^[:space:]@<>"]+$'),
  source text check (source is null or char_length(source) <= 40),
  created_at timestamptz not null default now()
);
create unique index waitlist_email_lower_idx on public.waitlist (lower(email));
alter table public.waitlist enable row level security;
create policy waitlist_insert on public.waitlist for insert to anon, authenticated with check (true);
revoke all on public.waitlist from anon, authenticated;
grant insert (email, source) on public.waitlist to anon, authenticated;
