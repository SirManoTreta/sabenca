-- Auth inserts users before applying admin-supplied app_metadata.
-- Authorize staff creation through an expiring server-only invitation instead.
create table private.admin_invitations (
  email text primary key check (email = lower(btrim(email)) and char_length(email) <= 254),
  institution_id text not null references private.institutions(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index admin_invitations_expiry_idx on private.admin_invitations(expires_at);
create index admin_invitations_institution_idx on private.admin_invitations(institution_id);
alter table private.admin_invitations enable row level security;
revoke all on private.admin_invitations from public, anon, authenticated;
grant select (email, expires_at) on private.admin_invitations to supabase_auth_admin;
create policy auth_staff_registration_lookup on private.admin_invitations
  for select to supabase_auth_admin using (true);

create or replace function private.guard_auth_signup() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if exists (select 1 from private.institution_students where email = lower(new.email))
     or exists (select 1 from private.admin_invitations where email = lower(new.email) and expires_at > now()) then
    return new;
  end if;
  raise exception 'Institutional authorization required' using errcode = '42501';
end;
$$;
revoke all on function private.guard_auth_signup() from public, anon, authenticated;
