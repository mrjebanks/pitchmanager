create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  can_write_override boolean null,
  tab_overrides jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id)
);

insert into public.app_state (id, data)
values ('current', '{}'::jsonb)
on conflict (id) do nothing;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_user_profiles_updated on public.user_profiles;
create trigger on_user_profiles_updated
before update on public.user_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists on_app_state_updated on public.app_state;
create trigger on_app_state_updated
before update on public.app_state
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = case
          when excluded.display_name <> '' then excluded.display_name
          else public.user_profiles.display_name
        end,
        updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_is_active()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select user_profiles.is_active
      from public.user_profiles
      where user_profiles.user_id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select user_profiles.role = 'admin' and user_profiles.is_active
      from public.user_profiles
      where user_profiles.user_id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.current_user_can_write()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when user_profiles.can_write_override is not null then user_profiles.can_write_override
        when user_profiles.role = 'admin' then true
        else false
      end
      from public.user_profiles
      where user_profiles.user_id = auth.uid()
        and user_profiles.is_active
    ),
    false
  );
$$;

create or replace function public.strip_friendlies_from_app_state(raw_state jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  stripped jsonb := coalesce(raw_state, '{}'::jsonb) - 'friendlyBookings';
  season_key text;
  season_state jsonb;
begin
  if jsonb_typeof(stripped -> 'seasonStates') = 'object' then
    for season_key, season_state in
      select key, value
      from jsonb_each(stripped -> 'seasonStates')
    loop
      stripped := jsonb_set(
        stripped,
        array['seasonStates', season_key],
        season_state - 'friendlyBookings',
        true
      );
    end loop;
  end if;

  return stripped;
end;
$$;

create or replace function public.guard_app_state_friendlies_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_can_write() then
    return new;
  end if;

  if not public.current_user_is_active() then
    raise exception 'Write access is required.' using errcode = '42501';
  end if;

  if public.strip_friendlies_from_app_state(new.data) is not distinct from public.strip_friendlies_from_app_state(old.data) then
    new.updated_by = auth.uid();
    return new;
  end if;

  raise exception 'Only friendly bookings can be changed by this account.' using errcode = '42501';
end;
$$;

drop trigger if exists guard_app_state_friendlies_write on public.app_state;
create trigger guard_app_state_friendlies_write
before update on public.app_state
for each row execute function public.guard_app_state_friendlies_write();

alter table public.user_profiles enable row level security;
alter table public.app_state enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read all profiles" on public.user_profiles;
create policy "Admins can read all profiles"
on public.user_profiles
for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can update profiles" on public.user_profiles;
create policy "Admins can update profiles"
on public.user_profiles
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Authenticated users can read app state" on public.app_state;
create policy "Authenticated users can read app state"
on public.app_state
for select
to authenticated
using (public.current_user_is_active());

drop policy if exists "Writers can insert app state" on public.app_state;
create policy "Writers can insert app state"
on public.app_state
for insert
to authenticated
with check (public.current_user_can_write());

drop policy if exists "Writers can update app state" on public.app_state;
create policy "Writers can update app state"
on public.app_state
for update
to authenticated
using (public.current_user_can_write())
with check (public.current_user_can_write());

drop policy if exists "Active users can update friendly bookings" on public.app_state;
create policy "Active users can update friendly bookings"
on public.app_state
for update
to authenticated
using (public.current_user_is_active())
with check (public.current_user_is_active());
