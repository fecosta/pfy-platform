-- SPEC-002 Phase 1: application-owned identity and profile foundation.
-- Email normalization is deliberately limited to trimming surrounding
-- whitespace and lower-casing. Provider-specific aliases are not applied.

create or replace function public.pfy_normalize_email(input text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select lower(btrim(input));
$$;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  legacy_wp_user_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_emails (
  user_id uuid primary key references public.users (id) on delete cascade,
  email text not null check (btrim(email) <> ''),
  normalized_email text generated always as (public.pfy_normalize_email(email)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_emails_normalized_email_not_empty check (normalized_email <> '')
);

create unique index user_emails_normalized_email_key
  on public.user_emails (normalized_email);

create table public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  first_name text not null check (btrim(first_name) <> ''),
  last_name text not null check (btrim(last_name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.pfy_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.pfy_set_updated_at();

create trigger user_emails_set_updated_at
before update on public.user_emails
for each row execute function public.pfy_set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.pfy_set_updated_at();

alter table public.users enable row level security;
alter table public.user_emails enable row level security;
alter table public.profiles enable row level security;

-- This predicate is intentionally boolean-only. It is used by the profile RLS
-- policies and does not expose identity or email-directory data.
create or replace function public.pfy_is_profile_owner(profile_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where users.id = profile_user_id
      and users.auth_user_id = (select auth.uid())
  );
$$;

revoke all on public.users, public.user_emails, public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name) on public.profiles to authenticated;
grant execute on function public.pfy_is_profile_owner(uuid) to authenticated;

create policy profiles_owner_select
on public.profiles
for select
to authenticated
using (public.pfy_is_profile_owner(user_id));

create policy profiles_owner_update
on public.profiles
for update
to authenticated
using (public.pfy_is_profile_owner(user_id))
with check (public.pfy_is_profile_owner(user_id));

-- Provisioning and first-auth linking are server-boundary operations. The
-- service role is never placed in browser-visible configuration.
create or replace function public.pfy_provision_identity(
  requested_email text,
  requested_first_name text,
  requested_last_name text,
  requested_auth_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized text := public.pfy_normalize_email(requested_email);
  resolved_user_id uuid;
  auth_email text;
  existing_auth_user_id uuid;
begin
  if normalized = '' or btrim(requested_first_name) = '' or btrim(requested_last_name) = '' then
    raise exception using errcode = '22023', message = 'email and profile names are required';
  end if;

  -- Serialize provisioning for one normalized email while allowing unrelated
  -- emails to provision concurrently.
  perform pg_advisory_xact_lock(hashtextextended(normalized, 0));

  if requested_auth_user_id is not null then
    select email into auth_email from auth.users where id = requested_auth_user_id;
    if auth_email is null or public.pfy_normalize_email(auth_email) <> normalized then
      raise exception using errcode = '22023', message = 'authenticated email does not match login email';
    end if;
  end if;

  select user_id into resolved_user_id
  from public.user_emails
  where normalized_email = normalized;

  if resolved_user_id is null then
    insert into public.users (auth_user_id)
    values (requested_auth_user_id)
    returning id into resolved_user_id;

    insert into public.user_emails (user_id, email)
    values (resolved_user_id, requested_email);
  end if;

  select auth_user_id into existing_auth_user_id
  from public.users
  where id = resolved_user_id;

  if existing_auth_user_id is not null
     and requested_auth_user_id is not null
     and existing_auth_user_id <> requested_auth_user_id then
    raise exception using errcode = '23505', message = 'login identity is already linked';
  end if;

  if requested_auth_user_id is not null and existing_auth_user_id is null then
    update public.users
    set auth_user_id = requested_auth_user_id
    where id = resolved_user_id and auth_user_id is null;
  end if;

  insert into public.profiles (user_id, first_name, last_name)
  values (resolved_user_id, btrim(requested_first_name), btrim(requested_last_name))
  on conflict (user_id) do nothing;

  return resolved_user_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'identity conflicts with an existing identity';
end;
$$;

create or replace function public.pfy_link_authenticated_identity(
  authenticated_user_id uuid,
  authenticated_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized text := public.pfy_normalize_email(authenticated_email);
  resolved_user_id uuid;
  linked_user_id uuid;
  auth_record_email text;
begin
  select email into auth_record_email
  from auth.users
  where id = authenticated_user_id;

  if auth_record_email is null
     or public.pfy_normalize_email(auth_record_email) <> normalized then
    raise exception using errcode = '22023', message = 'authenticated email is not verified';
  end if;

  select id, auth_user_id into resolved_user_id, linked_user_id
  from public.users
  where id = (select user_id from public.user_emails where normalized_email = normalized)
  for update;

  if resolved_user_id is null then
    raise exception using errcode = 'P0002', message = 'no PFY identity owns authenticated email';
  end if;

  if linked_user_id is not null and linked_user_id <> authenticated_user_id then
    raise exception using errcode = '23505', message = 'PFY identity is already linked';
  end if;

  update public.users
  set auth_user_id = authenticated_user_id
  where id = resolved_user_id and auth_user_id is null;

  return resolved_user_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'authentication identity is already linked';
end;
$$;

create or replace function public.pfy_login_email_exists(submitted_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_emails
    where normalized_email = public.pfy_normalize_email(submitted_email)
  );
$$;

revoke all on function public.pfy_provision_identity(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.pfy_link_authenticated_identity(uuid, text) from public, anon, authenticated;
revoke all on function public.pfy_login_email_exists(text) from public, anon, authenticated;
grant execute on function public.pfy_provision_identity(text, text, text, uuid) to service_role;
grant execute on function public.pfy_link_authenticated_identity(uuid, text) to service_role;
grant execute on function public.pfy_login_email_exists(text) to service_role;
